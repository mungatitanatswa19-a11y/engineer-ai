import { jsonError } from "@/lib/ai";
import { backendReady, currentUser, isAdminUser, supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) || null : null);

/** Owner actions: publish a private paper, or take a paper back to private. */
export async function PATCH(req: Request, { params }: Ctx) {
  if (!backendReady()) return jsonError("Supabase is not configured yet.", 503);
  const { id } = await params;
  const user = await currentUser();
  if (!user) return jsonError("Please sign in.", 401);

  const admin = supabaseAdmin();
  const { data: paper } = await admin.from("papers").select("*").eq("id", id).single();
  if (!paper || paper.uploader_id !== user.id) return jsonError("Paper not found.", 404);
  if (paper.status === "removed") return jsonError("This paper was removed by a moderator.", 403);

  const body = await req.json().catch(() => ({}));

  if (body.action === "unpublish") {
    await admin.from("papers").update({ status: "private", published_at: null }).eq("id", id);
    return Response.json({ ok: true, status: "private" });
  }

  if (body.action === "publish") {
    if (body.consent !== true) return jsonError("You must confirm you are allowed to share this paper publicly.");
    const subject = str(body.subject) ?? paper.subject;
    const course = str(body.course) ?? paper.course;
    if (!subject || !course) return jsonError("Subject and course are required to publish.");
    const yearN = Number(body.year);
    const status = process.env.PAPER_MODERATION === "on" ? "pending" : "published";
    const { error } = await admin
      .from("papers")
      .update({
        title: str(body.title, 150) ?? paper.title,
        description: str(body.description, 1000) ?? paper.description,
        subject,
        course,
        institution: str(body.institution) ?? paper.institution,
        level: str(body.level) ?? paper.level,
        exam_type: str(body.exam_type) ?? paper.exam_type,
        year: Number.isFinite(yearN) && yearN >= 1950 && yearN <= 2100 ? yearN : paper.year,
        status,
        published_at: status === "published" ? new Date().toISOString() : null,
      })
      .eq("id", id);
    if (error) return jsonError("Could not publish.", 500);
    return Response.json({ ok: true, status });
  }

  return jsonError("Unknown action.");
}

/** Delete a paper (owner or admin). */
export async function DELETE(_req: Request, { params }: Ctx) {
  if (!backendReady()) return jsonError("Supabase is not configured yet.", 503);
  const { id } = await params;
  const user = await currentUser();
  if (!user) return jsonError("Please sign in.", 401);

  const admin = supabaseAdmin();
  const { data: paper } = await admin.from("papers").select("uploader_id, file_path").eq("id", id).single();
  if (!paper) return jsonError("Paper not found.", 404);
  if (paper.uploader_id !== user.id && !(await isAdminUser(user.id))) return jsonError("Not allowed.", 403);

  await admin.storage.from("papers").remove([paper.file_path]);
  await admin.from("papers").delete().eq("id", id);
  return Response.json({ ok: true });
}
