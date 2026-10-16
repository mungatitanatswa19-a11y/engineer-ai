import type Anthropic from "@anthropic-ai/sdk";
import { fileToBlock, jsonError, streamResponse } from "@/lib/ai";
import { validateFile } from "@/lib/files";
import { SYSTEM_PROMPT, TOOL_PROMPTS } from "@/lib/prompts";
import { rateLimit } from "@/lib/ratelimit";
import { aiReady, currentUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Study Tools: notes, summaries, solver, flashcards, quizzes, assignment helper, diagram explainer, planner. */
export async function POST(req: Request) {
  if (!aiReady()) return jsonError("The AI is not configured yet. Add ANTHROPIC_API_KEY on the server.", 503);

  const user = await currentUser();
  if (!user) return jsonError("Please sign in to use Study Tools.", 401);
  if (!rateLimit(`tools:${user.id}`, 15, 10 * 60_000)) return jsonError("Too many requests. Please wait a few minutes.", 429);

  const form = await req.formData().catch(() => null);
  if (!form) return jsonError("Invalid request.");

  const tool = String(form.get("tool") ?? "");
  const text = String(form.get("text") ?? "").slice(0, 40_000);
  const file = form.get("file");
  const def = TOOL_PROMPTS[tool];
  if (!def) return jsonError("Unknown tool.");

  const content: Anthropic.ContentBlockParam[] = [];
  if (file instanceof File && file.size > 0) {
    const buf = Buffer.from(await file.arrayBuffer());
    const v = validateFile(file.name, file.type, buf);
    if (!v.ok) return jsonError(v.error);
    content.push(await fileToBlock(file.name, v.mime, buf));
  }
  if (!content.length && !text.trim()) return jsonError("Add some text, a topic, or a file first.");

  content.push({ type: "text", text: `${def.prompt}\n\n${text.trim() ? `Student input:\n${text}` : "Use the attached file as the source material."}` });

  return streamResponse({
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content }],
    maxTokens: 6000,
  });
}
