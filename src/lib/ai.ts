import Anthropic from "@anthropic-ai/sdk";
import mammoth from "mammoth";
import type { AllowedMime } from "./files";

export const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";

let client: Anthropic | null = null;
export function anthropic() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

/** Convert an uploaded file into a content block the model can read. */
export async function fileToBlock(
  name: string,
  mime: AllowedMime,
  buf: Buffer
): Promise<Anthropic.ContentBlockParam> {
  switch (mime) {
    case "application/pdf":
      return {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: buf.toString("base64") },
      };
    case "image/png":
    case "image/jpeg":
    case "image/webp":
      return {
        type: "image",
        source: { type: "base64", media_type: mime, data: buf.toString("base64") },
      };
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      const { value } = await mammoth.extractRawText({ buffer: buf });
      return { type: "text", text: `Contents of ${name}:\n\n${value.slice(0, 120_000)}` };
    }
    default:
      return { type: "text", text: `Contents of ${name}:\n\n${buf.toString("utf8").slice(0, 120_000)}` };
  }
}

/** Stream model output to the browser as plain text. */
export function streamResponse(opts: {
  system: string;
  messages: Anthropic.MessageParam[];
  maxTokens?: number;
  headers?: Record<string, string>;
  onDone?: (fullText: string) => Promise<void> | void;
}) {
  const enc = new TextEncoder();
  const stream = anthropic().messages.stream({
    model: MODEL,
    max_tokens: opts.maxTokens ?? 4096,
    system: opts.system,
    messages: opts.messages,
  });

  const body = new ReadableStream({
    async start(controller) {
      let full = "";
      try {
        for await (const ev of stream) {
          if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
            full += ev.delta.text;
            controller.enqueue(enc.encode(ev.delta.text));
          }
        }
        if (opts.onDone && full) await opts.onDone(full);
      } catch (err) {
        console.error("AI stream error", err);
        controller.enqueue(enc.encode("\n\n⚠️ The AI service had a problem. Please try again in a moment."));
      }
      controller.close();
    },
    cancel() {
      stream.abort();
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
      ...opts.headers,
    },
  });
}

export function jsonError(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}
