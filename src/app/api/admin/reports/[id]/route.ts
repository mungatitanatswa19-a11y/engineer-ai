import { jsonError } from "@/lib/ai";
import { backendReady, currentUser, isAdminUser, supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!backendReady()) return jsonError("Supabase is not configured yet.", 503);
  const user = await currentUser();
  if (!user || !(await isAdminUser(user.id))) return jsonError("Admins only.", 403);

  const { id } = await params;
  const { status } = await req.json().catch(() => ({}));
  if (!["resolved", "dismissed"].includes(status)) return jsonError("Invalid status.");

  await supabaseAdmin().from("reports").update({ status }).eq("id", id);
  return Response.json({ ok: true });
}
