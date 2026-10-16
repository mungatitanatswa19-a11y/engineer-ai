import { anthropic, jsonError, MODEL } from "@/lib/ai";
import { imagePrompt, IMAGE_STYLES } from "@/lib/imageprompt";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { cleanSvg } from "@/lib/svg";
import { aiReady, currentUser, supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(req: Request) {
  if (!aiReady()) return jsonError("The AI is not configured yet. Add ANTHROPIC_API_KEY on the server.", 503);

  const user = await currentUser().catch(() => null);
  const key = user ? `img:${user.id}` : `img:${clientIp(req)}`;
  if (!rateLimit(key, user ? 12 : 3, 10 * 60_000)) {
    return jsonError(user ? "Image limit reached. Try again in a few minutes." : "Guest image limit reached. Sign in to create more.", 429);
  }

  let body: { prompt?: string; style?: string; detail?: string };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid request.");
  }
  const subject = String(body.prompt ?? "").replace(/\s+/g, " ").trim().slice(0, 600);
  if (subject.length < 3) return jsonError("Describe the component you want drawn.");
  const style = body.style && IMAGE_STYLES[body.style] ? body.style : "labelled";
  const high = body.detail === "high";

  let text = "";
  let truncated = false;
  try {
    const res = await anthropic().messages.create({
      model: MODEL,
      max_tokens: high ? 14000 : 9000,
      messages: [{ role: "user", content: imagePrompt(subject, style, high) }],
    });
    truncated = res.stop_reason === "max_tokens";
    text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  } catch (e) {
    console.error("image generation failed", e);
    return jsonError("The AI service had a problem. Please try again in a moment.", 502);
  }

  const svg = cleanSvg(text);
  if (!svg) {
    return jsonError(
      truncated
        ? "The drawing was cut off before it finished. Try Standard detail or a simpler subject."
        : "The drawing could not be read. Try again or describe it a little differently.",
      422
    );
  }

  const title = subject.slice(0, 70);
  let id: string | null = null;
  if (user && svg.length < 230_000) {
    try {
      const sb = await supabaseServer();
      const { data } = await sb
        .from("images")
        .insert({ user_id: user.id, title, prompt: subject, style, svg })
        .select("id")
        .single();
      id = data?.id ?? null;
    } catch (e) {
      console.error("save image failed", e);
    }
  }
  return Response.json({ id, title, svg, saved: Boolean(id) });
}
