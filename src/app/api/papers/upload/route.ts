import { jsonError } from "@/lib/ai";
import { safeName, validateFile } from "@/lib/files";
import { rateLimit } from "@/lib/ratelimit";
import { backendReady, currentUser, supabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

const str = (f: FormData, k: string, max = 200) => String(f.get(k) ?? "").trim().slice(0, max) || null;

/**
 * Upload a paper. visibility=private  -> only the uploader can see it (used for "Solve with Engineer AI")
 *                 visibility=publish  -> goes to the public library (needs explicit consent)
 */
export async function POST(req: Request) {
  if (!backendReady()) return jsonError("Supabase is not configured yet. See README.", 503);
  const user = await currentUser();
  if (!user) return jsonError("Please sign in to upload.", 401);
  if (!rateLimit(`upload:${user.id}`, 15, 60 * 60_000)) return jsonError("Upload limit reached. Try again later.", 429);

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof File)) return jsonError("Choose a file to upload.");

  const buf = Buffer.from(await file.arrayBuffer());
  const v = validateFile(file.name, file.type, buf);
  if (!v.ok) return jsonError(v.error);

  const publish = form.get("visibility") === "publish";
  const title = str(form, "title", 150) ?? safeName(file.name).replace(/\.[^.]+$/, "");
  const subject = str(form, "subject");
  const course = str(form, "course");

  if (publish) {
    if (form.get("consent") !== "true") return jsonError("You must confirm you are allowed to share this paper publicly.");
    if (!subject || !course) return jsonError("Subject and course are required to publish.");
  }

  const yearRaw = parseInt(String(form.get("year") ?? ""), 10);
  const year = Number.isFinite(yearRaw) && yearRaw >= 1950 && yearRaw <= 2100 ? yearRaw : null;

  const admin = supabaseAdmin();
  const path = `${user.id}/${crypto.randomUUID()}.${v.ext}`;
  const up = await admin.storage.from("papers").upload(path, buf, { contentType: v.mime, upsert: false });
  if (up.error) return jsonError("Could not store the file. Please try again.", 500);

  const moderated = process.env.PAPER_MODERATION === "on";
  const status = !publish ? "private" : moderated ? "pending" : "published";

  const { data, error } = await admin
    .from("papers")
    .insert({
      uploader_id: user.id,
      title,
      description: str(form, "description", 1000),
      subject,
      course,
      institution: str(form, "institution"),
      level: str(form, "level"),
      year,
      exam_type: str(form, "exam_type"),
      file_path: path,
      file_type: v.mime,
      file_size: buf.length,
      status,
      published_at: status === "published" ? new Date().toISOString() : null,
    })
    .select("*")
    .single();

  if (error) {
    await admin.storage.from("papers").remove([path]);
    return jsonError("Could not save the paper record.", 500);
  }
  return Response.json({ paper: data, moderated: publish && moderated });
}
