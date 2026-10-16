import type Anthropic from "@anthropic-ai/sdk";
import { fileToBlock, jsonError, streamResponse } from "@/lib/ai";
import { validateFile } from "@/lib/files";
import { MODE_PROMPTS, SYSTEM_PROMPT } from "@/lib/prompts";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { aiReady, currentUser, supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 120;

type In = {
  messages: { role: "user" | "assistant"; content: string }[];
  mode?: string;
  chatId?: string | null;
  regenerate?: boolean;
  title?: string;
  attachments?: { name: string; mime: string; data: string }[];
};

export async function POST(req: Request) {
  if (!aiReady()) return jsonError("The AI is not configured yet. Add ANTHROPIC_API_KEY on the server.", 503);

  const user = await currentUser().catch(() => null);
  const key = user ? `chat:${user.id}` : `chat:${clientIp(req)}`;
  if (!rateLimit(key, user ? 40 : 12, 10 * 60_000)) {
    return jsonError(user ? "Slow down a little and try again shortly." : "Guest limit reached. Sign in for more messages.", 429);
  }

  let body: In;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid request.");
  }

  const msgs = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 12_000) }));
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return jsonError("Send a question first.");

  const attachments = (body.attachments ?? []).slice(0, 3);
  const blocks: Anthropic.ContentBlockParam[] = [];
  for (const a of attachments) {
    const buf = Buffer.from(a.data ?? "", "base64");
    const v = validateFile(a.name ?? "file", a.mime ?? "", buf);
    if (!v.ok) return jsonError(`${a.name}: ${v.error}`);
    blocks.push(await fileToBlock(a.name, v.mime, buf));
  }

  const apiMessages: Anthropic.MessageParam[] = msgs.map((m, i) =>
    i === msgs.length - 1 && blocks.length
      ? { role: "user", content: [...blocks, { type: "text", text: m.content }] }
      : { role: m.role, content: m.content }
  );

  const mode = MODE_PROMPTS[body.mode ?? "standard"] ? (body.mode as string) : "standard";
  const system = `${SYSTEM_PROMPT}\n\nResponse style: ${MODE_PROMPTS[mode]}`;

  // Persist history for signed-in users only (RLS keeps it private).
  let chatId = body.chatId ?? null;
  const lastUser = msgs[msgs.length - 1].content;
  const note = attachments.length ? `\n\n📎 ${attachments.map((a) => a.name).join(", ")}` : "";
  const sb = user ? await supabaseServer() : null;

  if (sb && user) {
    try {
      if (!chatId) {
        const { data } = await sb
          .from("chats")
          .insert({ user_id: user.id, title: (typeof body.title === "string" && body.title.trim() ? body.title : lastUser).slice(0, 60) })
          .select("id")
          .single();
        chatId = data?.id ?? null;
      }
      if (chatId && body.regenerate) {
        // Regenerate: replace the previous answer instead of duplicating the question.
        const { data: prev } = await sb
          .from("messages").select("id").eq("chat_id", chatId).eq("role", "assistant")
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (prev?.id) await sb.from("messages").delete().eq("id", prev.id);
      } else if (chatId) {
        await sb.from("messages").insert({ chat_id: chatId, role: "user", content: lastUser + note });
      }
    } catch (e) {
      console.error("save user message failed", e);
    }
  }

  return streamResponse({
    system,
    messages: apiMessages,
    maxTokens: 4096,
    headers: chatId ? { "X-Chat-Id": chatId } : {},
    onDone: async (text) => {
      if (sb && chatId) {
        await sb.from("messages").insert({ chat_id: chatId, role: "assistant", content: text });
        await sb.from("chats").update({ updated_at: new Date().toISOString() }).eq("id", chatId);
      }
    },
  });
}
