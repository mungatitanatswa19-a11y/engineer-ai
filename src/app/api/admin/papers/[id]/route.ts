import { jsonError } from "@/lib/ai";
import { backendReady, currentUser, isAdminUser, supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

/** Admin moderation: approve a pending paper, remove a harmful one, or restore it. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!backendReady()) return jsonError("Supabase is not configured yet.", 503);
  const user = await currentUser();
  if (!user || !(await isAdminUser(user.id))) return jsonError("Admins only.", 403);

  const { id } = await params;
  const { action } = await req.json().catch(() => ({}));
  const admin = supabaseAdmin();

  if (action === "approve" || action === "restore") {
    await admin.from("papers").update({ status: "published", published_at: new Date().toISOString(), report_count: 0 }).eq("id", id);
    await admin.from("reports").update({ status: "dismissed" }).eq("paper_id", id).eq("status", "open");
  } else if (action === "remove") {
    await admin.from("papers").update({ status: "removed" }).eq("id", id);
    await admin.from("reports").update({ status: "resolved" }).eq("paper_id", id).eq("status", "open");
  } else {
    return jsonError("Unknown action.");
  }
  return Response.json({ ok: true });
}
