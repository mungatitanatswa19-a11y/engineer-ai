import { jsonError } from "@/lib/ai";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { backendReady, currentUser, supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!backendReady()) return jsonError("Supabase is not configured yet.", 503);
  if (!rateLimit(`fb:${clientIp(req)}`, 5, 60 * 60_000)) return jsonError("Too many messages. Try again later.", 429);

  const { name, email, message } = await req.json().catch(() => ({}));
  if (typeof message !== "string" || message.trim().length < 5) return jsonError("Please write a message.");

  const user = await currentUser().catch(() => null);
  const { error } = await supabaseAdmin().from("feedback").insert({
    user_id: user?.id ?? null,
    name: typeof name === "string" ? name.slice(0, 100) : null,
    email: typeof email === "string" ? email.slice(0, 200) : null,
    message: message.slice(0, 3000),
  });
  if (error) return jsonError("Could not send your message.", 500);
  return Response.json({ ok: true });
}
