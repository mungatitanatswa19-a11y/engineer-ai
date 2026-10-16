"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { BookText, CalendarDays, ClipboardList, FileQuestion, Layers, Microscope, NotebookPen, Paperclip, ScrollText } from "lucide-react";
import Markdown from "@/components/Markdown";
import { useUser } from "@/components/useUser";
import { errorText, readStream } from "@/lib/stream";

const TOOLS = [
  { id: "notes", title: "AI Notes", desc: "Turn notes into organized study notes", icon: NotebookPen, file: true, ph: "Paste your notes here, or attach a file/photo…" },
  { id: "summary", title: "AI Summaries", desc: "Summarize long engineering documents", icon: ScrollText, file: true, ph: "Paste text to summarize, or attach a PDF/document…" },
  { id: "solver", title: "Question Solver", desc: "Upload a paper, get explained answers", icon: FileQuestion, file: true, ph: "Paste questions here, or attach a photo/PDF of the paper…" },
  { id: "flashcards", title: "Flashcards", desc: "Q&A cards for revision", icon: Layers, file: true, ph: "Enter a topic (e.g. 'Diesel fuel injection pumps') or paste notes…" },
  { id: "quiz", title: "Practice Tests", desc: "MCQ + written questions with answers", icon: ClipboardList, file: true, ph: "Enter a topic or paste notes to be tested on…" },
  { id: "assignment", title: "Assignment Helper", desc: "Structure, intro, sections, conclusion", icon: BookText, file: true, ph: "Paste the assignment question/brief and any notes you have…" },
  { id: "diagram", title: "Diagram Explainer", desc: "Explain components & operation", icon: Microscope, file: true, ph: "Optional: what system is this? Attach the diagram image or PDF." },
  { id: "planner", title: "Revision Planner", desc: "Plan study sessions for your exams", icon: CalendarDays, file: false, ph: "List your subjects, exam dates, and how many hours a day you can study…" },
];

export default function ToolsPage() {
  const { user, loading } = useUser();
  const [active, setActive] = useState(TOOLS[0]);
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [out, setOut] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function run() {
    setError("");
    setOut("");
    if (!text.trim() && !file) return setError("Add some text, a topic, or a file first.");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("tool", active.id);
      fd.append("text", text);
      if (file) fd.append("file", file);
      const res = await fetch("/api/tools", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await errorText(res));
      await readStream(res, setOut);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      <div>
        <h1 className="text-3xl font-extrabold">Study Tools</h1>
        <p className="text-muted">Pick a tool, add your material, and let Engineer AI do the heavy lifting.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => { setActive(t); setOut(""); setError(""); if (!t.file) setFile(null); }}
              className={`card p-3 text-left transition ${active.id === t.id ? "!border-electric ring-2 ring-electric/30" : "hover:border-electric"}`}
            >
              <Icon className="text-electric" size={22} />
              <p className="mt-2 text-sm font-bold">{t.title}</p>
              <p className="text-xs text-muted">{t.desc}</p>
            </button>
          );
        })}
      </div>

      {!loading && !user ? (
        <div className="card p-6 text-center">
          <p className="font-semibold">Sign in to use Study Tools</p>
          <Link href="/login" className="btn btn-primary mt-3">Sign in / Sign up</Link>
        </div>
      ) : (
        <div className="card space-y-3 p-4">
          <h2 className="font-bold">{active.title}</h2>
          <textarea className="input min-h-36" value={text} onChange={(e) => setText(e.target.value)} placeholder={active.ph} maxLength={40000} />
          {active.file && (
            <div className="flex flex-wrap items-center gap-2">
              <input ref={fileRef} type="file" hidden accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.docx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}><Paperclip size={16} /> {file ? file.name : "Attach file or photo"}</button>
              {file && <button className="text-sm text-electric" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }}>Remove</button>}
            </div>
          )}
          {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
          <button className="btn btn-primary" onClick={run} disabled={busy}>{busy ? "Working…" : `Run ${active.title}`}</button>
        </div>
      )}

      {out && (
        <div className="card p-4 md:p-6 fade-in">
          <Markdown>{out}</Markdown>
          {!busy && <button className="btn btn-ghost mt-4" onClick={() => navigator.clipboard.writeText(out)}>Copy</button>}
        </div>
      )}
    </div>
  );
}
