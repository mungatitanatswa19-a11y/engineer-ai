import { NextResponse } from "next/server";
import { jsonError } from "@/lib/ai";
import { rateLimit, clientIp } from "@/lib/ratelimit";
import { backendReady, currentUser, isAdminUser, supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Public download/preview. No login needed for PUBLISHED papers.
 * Private/pending/removed papers are only available to the uploader (or an admin).
 * The storage bucket itself is private; we hand out a 60-second signed link.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!backendReady()) return jsonError("Supabase is not configured yet.", 503);
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return jsonError("Not found.", 404);
  if (!rateLimit(`dl:${clientIp(req)}`, 120, 10 * 60_000)) return jsonError("Too many downloads. Slow down.", 429);

  const view = new URL(req.url).searchParams.get("view") === "1";
  const admin = supabaseAdmin();
  const { data: paper } = await admin.from("papers").select("*").eq("id", id).single();
  if (!paper) return jsonError("Paper not found.", 404);

  if (paper.status !== "published") {
    const user = await currentUser();
    const ok = user && (paper.uploader_id === user.id || (await isAdminUser(user.id)));
    if (!ok) return jsonError("Paper not found.", 404);
  }

  const ext = paper.file_path.split(".").pop();
  const filename = `${paper.title.replace(/[^a-zA-Z0-9 _-]/g, "").trim().slice(0, 80) || "paper"}.${ext}`;
  const { data, error } = await admin.storage
    .from("papers")
    .createSignedUrl(paper.file_path, 60, view ? undefined : { download: filename });
  if (error || !data) return jsonError("Could not prepare the file.", 500);

  if (!view && paper.status === "published") await admin.rpc("increment_download", { p: id });
  return NextResponse.redirect(data.signedUrl);
}
