"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BookOpen, CheckCircle2, FileUp, Sparkles } from "lucide-react";
import { useUser } from "@/components/useUser";
import { COURSES, EXAM_TYPES, LEVELS, SUBJECTS } from "@/lib/types";

const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.txt,.docx";

export default function UploadPage() {
  const router = useRouter();
  const { user, loading } = useUser();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [f, setF] = useState({ title: "", description: "", subject: "", course: "", institution: "", level: "", year: "", exam_type: "" });
  const [consent, setConsent] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ moderated: boolean } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) return setPreviewUrl(null);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  function pick(files: FileList | null) {
    const picked = files?.[0];
    if (!picked) return;
    setError("");
    if (picked.size > 10 * 1024 * 1024) return setError("File is larger than 10 MB.");
    setFile(picked);
    if (!f.title) setF((s) => ({ ...s, title: picked.name.replace(/\.[^.]+$/, "") }));
  }

  function upload(visibility: "private" | "publish") {
    setError("");
    if (!file) return setError("Choose a file first.");
    if (!f.title.trim()) return setError("Add a title.");
    if (visibility === "publish") {
      if (!f.subject || !f.course) return setError("Choose a subject and course to publish.");
      if (!consent) return setError("Tick the box to confirm you are allowed to share this paper publicly.");
    }

    const fd = new FormData();
    fd.append("file", file);
    Object.entries(f).forEach(([k, v]) => fd.append(k, v));
    fd.append("visibility", visibility);
    fd.append("consent", String(consent));

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/papers/upload");
    xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onerror = () => { setProgress(null); setError("Network error. Please try again."); };
    xhr.onload = () => {
      setProgress(null);
      let body: { paper?: { id: string }; moderated?: boolean; error?: string } = {};
      try { body = JSON.parse(xhr.responseText); } catch {}
      if (xhr.status >= 200 && xhr.status < 300 && body.paper) {
        if (visibility === "private") router.push(`/solve/${body.paper.id}`);
        else setDone({ moderated: Boolean(body.moderated) });
      } else {
        setError(body.error || "Upload failed.");
      }
    };
    setProgress(0);
    xhr.send(fd);
  }

  if (loading) return <p className="p-6 text-muted">Loading…</p>;

  if (!user)
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <FileUp className="mx-auto text-electric" size={40} />
        <h1 className="mt-4 text-2xl font-extrabold">Sign in to upload</h1>
        <p className="mt-2 text-muted">Uploading requires an account so your private files stay private and the community stays safe. Browsing and downloading papers never needs one.</p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/login" className="btn btn-primary">Sign in / Sign up</Link>
          <Link href="/library" className="btn btn-ghost">Browse library</Link>
        </div>
      </div>
    );

  if (done)
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <CheckCircle2 className="mx-auto text-green-500" size={44} />
        <h1 className="mt-4 text-2xl font-extrabold">{done.moderated ? "Submitted for review" : "Published!"}</h1>
        <p className="mt-2 text-muted">
          {done.moderated
            ? "Your paper will appear in the library once a moderator approves it."
            : "Your paper is now in the public library. Thank you for helping other students."}
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/library" className="btn btn-primary">Go to library</Link>
          <button className="btn btn-ghost" onClick={() => { setDone(null); setFile(null); setConsent(false); setF({ title: "", description: "", subject: "", course: "", institution: "", level: "", year: "", exam_type: "" }); }}>Upload another</button>
        </div>
      </div>
    );

  const isImg = file?.type.startsWith("image/");
  const isPdf = file?.type === "application/pdf";

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <div>
        <h1 className="text-3xl font-extrabold">Upload a Question Paper</h1>
        <p className="text-muted">Your upload stays <b>private</b> unless you choose to publish it.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files); }}
            className="card flex w-full flex-col items-center gap-2 border-dashed p-8 text-center hover:border-electric"
          >
            <FileUp className="text-electric" size={32} />
            <span className="font-semibold">{file ? file.name : "Tap to choose or drop a file"}</span>
            <span className="text-xs text-muted">PDF, PNG, JPG, WEBP, DOCX or TXT · max 10 MB</span>
          </button>
          <input ref={inputRef} type="file" hidden accept={ACCEPT} onChange={(e) => pick(e.target.files)} />

          {file && previewUrl && (
            <div className="card overflow-hidden">
              <p className="border-b border-line px-3 py-2 text-xs font-semibold text-muted">Preview</p>
              {isImg && /* eslint-disable-next-line @next/next/no-img-element */ <img src={previewUrl} alt="Preview" className="max-h-96 w-full object-contain" />}
              {isPdf && <iframe src={previewUrl} title="PDF preview" className="h-96 w-full" />}
              {!isImg && !isPdf && <p className="p-4 text-sm text-muted">No inline preview for this file type ({file.name}).</p>}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <label className="block text-sm font-medium">Title *
            <input className="input mt-1" maxLength={150} value={f.title} onChange={set("title")} placeholder="e.g. DPF Fuel Systems Final Exam 2024" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium">Course
              <select className="input mt-1" value={f.course} onChange={set("course")}><option value="">Select…</option>{COURSES.map((c) => <option key={c}>{c}</option>)}</select>
            </label>
            <label className="block text-sm font-medium">Subject
              <select className="input mt-1" value={f.subject} onChange={set("subject")}><option value="">Select…</option>{SUBJECTS.map((c) => <option key={c}>{c}</option>)}</select>
            </label>
            <label className="block text-sm font-medium">Institution
              <input className="input mt-1" value={f.institution} onChange={set("institution")} />
            </label>
            <label className="block text-sm font-medium">Academic level
              <select className="input mt-1" value={f.level} onChange={set("level")}><option value="">Select…</option>{LEVELS.map((c) => <option key={c}>{c}</option>)}</select>
            </label>
            <label className="block text-sm font-medium">Year
              <input className="input mt-1" type="number" min={1950} max={2100} value={f.year} onChange={set("year")} />
            </label>
            <label className="block text-sm font-medium">Examination type
              <select className="input mt-1" value={f.exam_type} onChange={set("exam_type")}><option value="">Select…</option>{EXAM_TYPES.map((c) => <option key={c}>{c}</option>)}</select>
            </label>
          </div>
          <label className="block text-sm font-medium">Description (optional)
            <textarea className="input mt-1 min-h-20" maxLength={1000} value={f.description} onChange={set("description")} />
          </label>

          {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
          {progress !== null && (
            <div aria-live="polite">
              <div className="h-2 overflow-hidden rounded-full bg-line"><div className="h-full bg-electric transition-all" style={{ width: `${progress}%` }} /></div>
              <p className="mt-1 text-xs text-muted">Uploading… {progress}%</p>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="card flex flex-col gap-3 p-5">
          <h2 className="flex items-center gap-2 font-bold"><Sparkles size={18} className="text-electric" /> Option A: Solve with Engineer AI</h2>
          <p className="text-sm text-muted">Engineer AI reads the paper, keeps your question numbers, and answers each question with explanations sized to the marks. The file stays private to you.</p>
          <button className="btn btn-primary mt-auto" disabled={!file || progress !== null} onClick={() => upload("private")}>Solve with Engineer AI</button>
        </div>
        <div className="card flex flex-col gap-3 p-5">
          <h2 className="flex items-center gap-2 font-bold"><BookOpen size={18} className="text-electric" /> Option B: Publish to Question Paper Library</h2>
          <p className="text-sm text-muted">Share this paper so every visitor can search, preview and download it. Course and subject are required.</p>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1 h-4 w-4" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>I confirm I have the right to share this document publicly, and I understand anyone can download it.</span>
          </label>
          <button className="btn btn-ghost mt-auto" disabled={!file || progress !== null} onClick={() => upload("publish")}>Publish to library</button>
        </div>
      </div>
    </div>
  );
}
