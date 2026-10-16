import { jsonError } from "@/lib/ai";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { backendReady, currentUser, supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

const REASONS = ["inappropriate", "copyright", "incorrect", "spam", "other"];
const AUTO_HIDE_AT = 5; // open reports before a paper is pulled back for review

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!backendReady()) return jsonError("Supabase is not configured yet.", 503);
  const { id } = await params;
  if (!rateLimit(`report:${clientIp(req)}`, 8, 60 * 60_000)) return jsonError("Too many reports. Try again later.", 429);

  const { reason, details } = await req.json().catch(() => ({}));
  if (!REASONS.includes(reason)) return jsonError("Choose a reason.");

  const admin = supabaseAdmin();
  const { data: paper } = await admin.from("papers").select("id, status, report_count").eq("id", id).single();
  if (!paper || paper.status !== "published") return jsonError("Paper not found.", 404);

  const user = await currentUser().catch(() => null);
  const { error } = await admin.from("reports").insert({
    paper_id: id,
    reporter_id: user?.id ?? null,
    reason,
    details: typeof details === "string" ? details.slice(0, 1000) : null,
  });
  if (error) return jsonError("Could not submit the report.", 500);

  const count = paper.report_count + 1;
  await admin
    .from("papers")
    .update({ report_count: count, ...(count >= AUTO_HIDE_AT ? { status: "pending" } : {}) })
    .eq("id", id);

  return Response.json({ ok: true });
}
