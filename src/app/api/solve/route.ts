import type Anthropic from "@anthropic-ai/sdk";
import { fileToBlock, jsonError, streamResponse } from "@/lib/ai";
import { validateFile } from "@/lib/files";
import { MODE_PROMPTS, SOLVE_PROMPT, SYSTEM_PROMPT } from "@/lib/prompts";
import { rateLimit } from "@/lib/ratelimit";
import { aiReady, backendReady, currentUser, isAdminUser, supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Option A: "Solve with Engineer AI". Works on the user's private upload or any published paper. */
export async function POST(req: Request) {
  if (!aiReady()) return jsonError("The AI is not configured yet. Add ANTHROPIC_API_KEY on the server.", 503);
  if (!backendReady()) return jsonError("Supabase is not configured yet.", 503);

  const user = await currentUser();
  if (!user) return jsonError("Please sign in to solve a paper.", 401);
  if (!rateLimit(`solve:${user.id}`, 6, 10 * 60_000)) return jsonError("Too many solves in a short time. Please wait a few minutes.", 429);

  const { paperId, mode } = (await req.json().catch(() => ({}))) as { paperId?: string; mode?: string };
  if (!paperId) return jsonError("Missing paperId.");

  const admin = supabaseAdmin();
  const { data: paper } = await admin.from("papers").select("*").eq("id", paperId).single();
  if (!paper) return jsonError("Paper not found.", 404);

  const allowed = paper.status === "published" || paper.uploader_id === user.id || (await isAdminUser(user.id));
  if (!allowed) return jsonError("You do not have access to this paper.", 403);

  const { data: file, error } = await admin.storage.from("papers").download(paper.file_path);
  if (error || !file) return jsonError("Could not read the stored file.", 500);
  const buf = Buffer.from(await file.arrayBuffer());
  const v = validateFile(paper.file_path, paper.file_type, buf);
  if (!v.ok) return jsonError(v.error);

  const block = await fileToBlock(paper.title, v.mime, buf);
  const style = MODE_PROMPTS[mode ?? "exam"] ?? MODE_PROMPTS.exam;
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: [block, { type: "text", text: `${SOLVE_PROMPT}\n\nPaper title: ${paper.title}${paper.subject ? `\nSubject: ${paper.subject}` : ""}` }] },
  ];

  // Save the solution to the user's private chat history
  const sb = await supabaseServer();
  let chatId: string | null = null;
  try {
    const { data } = await sb.from("chats").insert({ user_id: user.id, title: `Solution: ${paper.title}`.slice(0, 80) }).select("id").single();
    chatId = data?.id ?? null;
    if (chatId) await sb.from("messages").insert({ chat_id: chatId, role: "user", content: `Solve paper: ${paper.title}` });
  } catch (e) {
    console.error(e);
  }

  return streamResponse({
    system: `${SYSTEM_PROMPT}\n\nResponse style: ${style}`,
    messages,
    maxTokens: 8000,
    headers: chatId ? { "X-Chat-Id": chatId } : {},
    onDone: async (text) => {
      if (chatId) await sb.from("messages").insert({ chat_id: chatId, role: "assistant", content: text });
    },
  });
}
