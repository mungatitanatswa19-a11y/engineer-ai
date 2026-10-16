"use client";
import Link from "next/link";
import { use, useEffect, useRef, useState } from "react";
import { BookOpen, Copy, MessageSquare } from "lucide-react";
import Markdown from "@/components/Markdown";
import { useUser } from "@/components/useUser";
import { errorText, readStream } from "@/lib/stream";
import { supabaseBrowser, supabaseConfigured } from "@/lib/supabase/client";
import type { Paper } from "@/lib/types";

export default function SolvePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading: userLoading } = useUser();
  const [paper, setPaper] = useState<Paper | null>(null);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [error, setError] = useState("");
  const [chatId, setChatId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishMsg, setPublishMsg] = useState("");
  const started = useRef(false);

  useEffect(() => {
    if (!supabaseConfigured) return;
    supabaseBrowser().from("papers").select("*").eq("id", id).single().then(({ data }) => setPaper(data as Paper | null));
  }, [id]);

  useEffect(() => {
    if (userLoading || !user || started.current) return;
    started.current = true;
    (async () => {
      setStatus("working");
      try {
        const res = await fetch("/api/solve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paperId: id, mode: "exam" }),
        });
        if (!res.ok) throw new Error(await errorText(res));
        setChatId(res.headers.get("X-Chat-Id"));
        await readStream(res, setText);
        setStatus("done");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
        setStatus("error");
      }
    })();
  }, [id, user, userLoading]);

  async function publish() {
    if (!paper) return;
    if (!paper.subject || !paper.course) {
      setPublishMsg("Add a subject and course first: use the Upload page and choose Option B.");
      return;
    }
    if (!confirm("Publish this paper to the public library? Anyone will be able to download it.")) return;
    setPublishing(true);
    const res = await fetch(`/api/papers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "publish", consent: true }),
    });
    setPublishing(false);
    setPublishMsg(res.ok ? "Done. Your paper was submitted to the library." : await errorText(res));
  }

  if (userLoading) return <p className="p-6 text-muted">Loading…</p>;
  if (!user)
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-extrabold">Sign in to solve papers</h1>
        <p className="mt-2 text-muted">Engineer AI needs an account for solving papers so your solutions are saved to your private history.</p>
        <Link href="/login" className="btn btn-primary mt-6">Sign in / Sign up</Link>
      </div>
    );

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-6">
      <div>
        <p className="text-sm text-muted">Engineer AI solution</p>
        <h1 className="text-2xl font-extrabold break-words">{paper?.title ?? "Question paper"}</h1>
      </div>

      {status === "working" && !text && <p className="card p-4 text-sm text-muted">Reading the paper and working through each question… large papers can take a minute.</p>}
      {status === "error" && <p role="alert" className="card p-4 text-sm text-red-500">{error}</p>}

      {text && (
        <div className="card p-4 md:p-6">
          <Markdown>{text}</Markdown>
        </div>
      )}

      {status === "done" && (
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-ghost" onClick={() => navigator.clipboard.writeText(text)}><Copy size={16} /> Copy solution</button>
          {chatId && <Link href={`/?chat=${chatId}`} className="btn btn-primary"><MessageSquare size={16} /> Ask follow-up questions</Link>}
          {paper?.status === "private" && paper.uploader_id === user.id && (
            <button className="btn btn-ghost" onClick={publish} disabled={publishing}><BookOpen size={16} /> Also publish to library</button>
          )}
        </div>
      )}
      {publishMsg && <p className="text-sm text-muted">{publishMsg}</p>}
      <p className="text-xs text-muted">AI answers can contain mistakes. Check specifications and procedures against your workshop manual or instructor.</p>
    </div>
  );
}
