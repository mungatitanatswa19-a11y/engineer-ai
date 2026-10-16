"use client";
import Link from "next/link";
import { useState } from "react";
import { Bookmark, BookmarkCheck, Download, Eye, Flag, Sparkles, X } from "lucide-react";
import { FILE_LABEL, type Paper } from "@/lib/types";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function PaperCard({
  paper,
  saved,
  onSavedChange,
  canSave,
}: {
  paper: Paper;
  saved?: boolean;
  onSavedChange?: (id: string, saved: boolean) => void;
  canSave?: boolean;
}) {
  const [reporting, setReporting] = useState(false);
  const [isSaved, setIsSaved] = useState(Boolean(saved));

  async function toggleSave() {
    const sb = supabaseBrowser();
    const { data } = await sb.auth.getUser();
    if (!data.user) {
      location.href = "/login";
      return;
    }
    if (isSaved) {
      await sb.from("paper_saves").delete().eq("paper_id", paper.id).eq("user_id", data.user.id);
    } else {
      await sb.from("paper_saves").insert({ paper_id: paper.id, user_id: data.user.id });
    }
    setIsSaved(!isSaved);
    onSavedChange?.(paper.id, !isSaved);
  }

  const meta = [paper.course, paper.institution, paper.level, paper.year].filter(Boolean).join(" · ");

  return (
    <article className="card flex flex-col gap-3 p-4 fade-in">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold leading-snug break-words">{paper.title}</h3>
          {paper.subject && <p className="mt-0.5 text-sm font-medium text-electric">{paper.subject}</p>}
        </div>
        <span className="shrink-0 rounded-lg bg-electric/10 px-2 py-1 text-xs font-bold text-electric">
          {FILE_LABEL[paper.file_type] ?? "FILE"}
        </span>
      </div>
      {meta && <p className="text-sm text-muted">{meta}</p>}
      {paper.exam_type && <p className="text-xs text-muted">{paper.exam_type}</p>}
      {paper.description && <p className="line-clamp-2 text-sm">{paper.description}</p>}
      <p className="text-xs text-muted">
        Uploaded {new Date(paper.published_at ?? paper.created_at).toLocaleDateString()} · {paper.download_count} download
        {paper.download_count === 1 ? "" : "s"}
        {paper.status !== "published" && <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-amber-600">{paper.status}</span>}
      </p>
      <div className="mt-auto flex flex-wrap gap-2">
        <a className="btn btn-ghost !min-h-10 !px-3 text-sm" href={`/api/papers/${paper.id}/download?view=1`} target="_blank" rel="noreferrer">
          <Eye size={15} /> Preview
        </a>
        <a className="btn btn-primary !min-h-10 !px-3 text-sm" href={`/api/papers/${paper.id}/download`}>
          <Download size={15} /> Download
        </a>
        <Link className="btn btn-ghost !min-h-10 !px-3 text-sm" href={`/solve/${paper.id}`}>
          <Sparkles size={15} /> Solve
        </Link>
        {canSave !== false && (
          <button className="btn btn-ghost !min-h-10 !px-3 text-sm" onClick={toggleSave} aria-label={isSaved ? "Unsave" : "Save"}>
            {isSaved ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
          </button>
        )}
        {paper.status === "published" && (
          <button className="btn btn-ghost !min-h-10 !px-3 text-sm" onClick={() => setReporting(true)} aria-label="Report">
            <Flag size={15} />
          </button>
        )}
      </div>
      {reporting && <ReportModal paperId={paper.id} onClose={() => setReporting(false)} />}
    </article>
  );
}

function ReportModal({ paperId, onClose }: { paperId: string; onClose: () => void }) {
  const [reason, setReason] = useState("inappropriate");
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | string>("idle");

  async function send() {
    setState("busy");
    const res = await fetch(`/api/papers/${paperId}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason, details }),
    });
    if (res.ok) setState("done");
    else setState((await res.json().catch(() => ({}))).error || "Could not send the report.");
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true">
      <div className="card w-full max-w-md space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h4 className="font-bold">Report this document</h4>
          <button onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        {state === "done" ? (
          <>
            <p className="text-sm">Thanks. An administrator will review this paper.</p>
            <button className="btn btn-primary w-full" onClick={onClose}>Close</button>
          </>
        ) : (
          <>
            <select className="input" value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="inappropriate">Inappropriate content</option>
              <option value="copyright">Copyright / unauthorized</option>
              <option value="incorrect">Incorrect upload (wrong subject/details)</option>
              <option value="spam">Spam or malicious</option>
              <option value="other">Other</option>
            </select>
            <textarea className="input min-h-24" maxLength={1000} placeholder="Details (optional)" value={details} onChange={(e) => setDetails(e.target.value)} />
            {state !== "idle" && state !== "busy" && <p className="text-sm text-red-500">{state}</p>}
            <button className="btn btn-primary w-full" onClick={send} disabled={state === "busy"}>
              {state === "busy" ? "Sending…" : "Submit report"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
