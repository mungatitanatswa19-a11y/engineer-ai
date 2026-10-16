"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUp, BookOpen, Calculator, Check, Copy, FileText, Image as ImageIcon, Layers, ListChecks, Paperclip, Plus,
  RefreshCw, Sparkles, Square, StickyNote, Upload, X,
} from "lucide-react";
import ImageCard from "./ImageCard";
import Markdown from "./Markdown";
import { errorText, fileToBase64, readStream } from "@/lib/stream";
import { supabaseBrowser, supabaseConfigured } from "@/lib/supabase/client";
import { type ChatMessage } from "@/lib/types";


const MODES = [
  { id: "standard", label: "Standard" },
  { id: "eli5", label: "Explain like I'm 5" },
  { id: "detailed", label: "Detailed (college)" },
  { id: "exam", label: "Exam answer" },
];

type Tool = "flash" | "quiz" | "notes" | "summary" | "image";
const TOOLS: { id: Tool; label: string; hint: string; icon: typeof Layers; prefix: string }[] = [
  { id: "image", label: "Create image", hint: "Describe the component to draw, e.g. “Cutaway of a diesel fuel injector”…", icon: ImageIcon, prefix: "" },
  { id: "flash", label: "Flashcards", hint: "Topic or pasted notes to turn into flashcards…", icon: Layers, prefix: "Create 15 revision flashcards. Format each exactly as:\n\n**Q1.** question\n**A1.** short, accurate answer\n\nTopic or material: " },
  { id: "quiz", label: "Practice quiz", hint: "Topic to be tested on…", icon: ListChecks, prefix: "Create a practice test: 8 multiple-choice questions (A-D) followed by 4 written questions with marks shown. Put the full marking guide and model answers in a section titled 'Answers' at the very end, after a horizontal rule.\n\nTopic or material: " },
  { id: "notes", label: "Study notes", hint: "Topic or pasted material to turn into notes…", icon: StickyNote, prefix: "Turn the following into organized study notes: a title, learning objectives, headed sections with concise bullets, key terms, formulas, common mistakes and a quick-revision summary.\n\nMaterial: " },
  { id: "summary", label: "Summarise", hint: "Paste text or attach a file to summarise…", icon: FileText, prefix: "Summarize the following (or the attached file). Start with a 3-sentence overview, then key points, key terms and any numbers or specifications.\n\nMaterial: " },
];

const MAX_ATTACH_BYTES = 4 * 1024 * 1024;

type Attachment = { name: string; mime: string; data: string; size: number };
type UiMsg = ChatMessage & { image?: { svg: string; title: string }; local?: boolean };

export default function Chat({ initialChatId, initialQuery }: { initialChatId?: string; initialQuery?: string }) {
  const [messages, setMessages] = useState<UiMsg[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("standard");
  const [tool, setTool] = useState<Tool | null>(null);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [chatId, setChatId] = useState<string | null>(initialChatId ?? null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [copied, setCopied] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const ctl = useRef<AbortController | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (!initialChatId || !supabaseConfigured) return;
    supabaseBrowser()
      .from("messages")
      .select("role, content")
      .eq("chat_id", initialChatId)
      .order("created_at")
      .then(({ data }) => setMessages((data as ChatMessage[]) ?? []));
  }, [initialChatId]);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), [messages]);

  useEffect(() => {
    if (initialQuery && !started.current) {
      started.current = true;
      void send(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!menu) return;
    const close = (e: KeyboardEvent) => e.key === "Escape" && setMenu(false);
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [menu]);

  async function addFiles(files: FileList | null) {
    if (!files) return;
    setError("");
    let total = attachments.reduce((s, a) => s + a.size, 0);
    const next = [...attachments];
    for (const f of Array.from(files).slice(0, 3)) {
      total += f.size;
      if (total > MAX_ATTACH_BYTES) {
        setError("Attachments in chat are limited to 4 MB in total. For bigger papers use Upload → Solve with Engineer AI.");
        break;
      }
      next.push({ name: f.name, mime: f.type, data: await fileToBase64(f), size: f.size });
    }
    setAttachments(next.slice(0, 3));
    if (fileRef.current) fileRef.current.value = "";
  }

  async function askText(history: UiMsg[], regenerate: boolean, sending: Attachment[], title?: string) {
    const c = new AbortController();
    ctl.current = c;
    const sendable = history.filter((m) => !m.local && !m.image).map(({ role, content }) => ({ role, content }));
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        signal: c.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: sendable, mode, chatId, attachments: sending, regenerate, title }),
      });
      if (!res.ok) throw new Error(await errorText(res));
      const id = res.headers.get("X-Chat-Id");
      if (id) setChatId(id);
      await readStream(res, (full) => setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: full }]));
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setMessages((m) => (m[m.length - 1]?.content ? m : [...m.slice(0, -1), { role: "assistant", content: "*(Stopped.)*", local: true }]));
      } else {
        setMessages(history);
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    }
  }

  async function askImage(subject: string, history: UiMsg[]) {
    const c = new AbortController();
    ctl.current = c;
    try {
      const res = await fetch("/api/image", {
        method: "POST",
        signal: c.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: subject, style: "labelled", detail: "standard" }),
      });
      if (!res.ok) throw new Error(await errorText(res));
      const j = (await res.json()) as { svg: string; title: string };
      setMessages([...history, { role: "assistant", content: `Image: ${j.title}`, image: { svg: j.svg, title: j.title }, local: true }]);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setMessages([...history, { role: "assistant", content: "*(Stopped.)*", local: true }]);
      } else {
        setMessages(history);
        setError(e instanceof Error ? e.message : "Something went wrong.");
      }
    }
  }

  async function send(text?: string) {
    const raw = (text ?? input).trim();
    if (!raw || busy) return;
    setError("");
    setInput("");
    setMenu(false);
    const t = TOOLS.find((x) => x.id === tool);
    setTool(null);
    const isImage = t?.id === "image";
    const content = t && !isImage ? t.prefix + raw : raw;
    const shown: UiMsg = { role: "user", content: isImage ? `🎨 ${raw}` : content, local: isImage };
    const history: UiMsg[] = [...messages, shown];
    setMessages([...history, { role: "assistant", content: "" }]);
    setBusy(true);
    const sending = attachments;
    setAttachments([]);
    try {
      if (isImage) await askImage(raw, history);
      else await askText(history, false, sending, raw);
    } finally {
      setBusy(false);
      ctl.current = null;
    }
  }

  async function regenerate() {
    if (busy) return;
    const h = [...messages];
    while (h.length && h[h.length - 1].role === "assistant") h.pop();
    if (!h.length || h[h.length - 1].local) return;
    setError("");
    setMessages([...h, { role: "assistant", content: "" }]);
    setBusy(true);
    try {
      await askText(h, true, []);
    } finally {
      setBusy(false);
      ctl.current = null;
    }
  }

  function newChat() {
    ctl.current?.abort();
    setMessages([]);
    setChatId(null);
    setError("");
    setTool(null);
    history.replaceState(null, "", "/");
  }

  const empty = messages.length === 0;
  const active = TOOLS.find((x) => x.id === tool);
  const lastIsAnswer = messages.length > 1 && messages[messages.length - 1].role === "assistant" && !messages[messages.length - 1].image;

  const composer = (
    <div className="mx-auto w-full max-w-3xl space-y-2">
      {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
      <div className="relative rounded-3xl border border-line bg-card p-2 shadow-sm focus-within:border-electric">
        {(attachments.length > 0 || active) && (
          <div className="flex flex-wrap gap-2 px-2 pb-1 pt-1">
            {active && (
              <span className="flex items-center gap-1 rounded-lg bg-electric px-2 py-1 text-xs font-medium text-white">
                <active.icon size={12} /> {active.label}
                <button aria-label="Remove tool" onClick={() => setTool(null)}><X size={12} /></button>
              </span>
            )}
            {attachments.map((a, i) => (
              <span key={i} className="flex items-center gap-1 rounded-lg bg-electric/10 px-2 py-1 text-xs">
                <Paperclip size={12} /> {a.name}
                <button aria-label="Remove" onClick={() => setAttachments(attachments.filter((_, j) => j !== i))}><X size={12} /></button>
              </span>
            ))}
          </div>
        )}
        <textarea
          ref={inputRef}
          rows={1}
          value={input}
          onChange={(e) => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 180) + "px"; }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          placeholder={active?.hint ?? "Ask anything about diesel plant fitting…"}
          className="block max-h-44 min-h-11 w-full resize-none bg-transparent px-3 py-2 outline-none"
          aria-label="Message Engineer AI"
        />
        <div className="flex items-center gap-2 px-1 pb-1">
          <input ref={fileRef} type="file" hidden multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.docx" onChange={(e) => addFiles(e.target.files)} />
          <div className="relative">
            <button className="grid h-9 w-9 place-items-center rounded-full border border-line hover:bg-electric/10" onClick={() => setMenu((o) => !o)} aria-label="Tools and attachments" aria-expanded={menu}>
              <Plus size={18} />
            </button>
            {menu && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
                <div role="menu" className="absolute bottom-11 left-0 z-40 w-64 max-w-[80vw] rounded-2xl border border-line bg-card p-1.5 shadow-xl fade-in">
                  <button role="menuitem" className="menu-item" onClick={() => { setMenu(false); fileRef.current?.click(); }}><Paperclip size={16} /> Add photos or files</button>
                  {TOOLS.map((t) => (
                    <button role="menuitem" key={t.id} className="menu-item" onClick={() => { setTool(t.id); setMenu(false); inputRef.current?.focus(); }}><t.icon size={16} /> {t.label}</button>
                  ))}
                  <div className="my-1 border-t border-line" />
                  <Link role="menuitem" href="/calculators" className="menu-item"><Calculator size={16} /> Calculators</Link>
                  <Link role="menuitem" href="/upload" className="menu-item"><Upload size={16} /> Solve a question paper</Link>
                </div>
              </>
            )}
          </div>
          <select value={mode} onChange={(e) => setMode(e.target.value)} aria-label="Answer style" className="h-9 rounded-full border border-line bg-transparent px-3 text-xs">
            {MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <span className="flex-1" />
          {busy ? (
            <button className="grid h-9 w-9 place-items-center rounded-full bg-ink text-app" onClick={() => ctl.current?.abort()} aria-label="Stop"><Square size={14} /></button>
          ) : (
            <button className="grid h-9 w-9 place-items-center rounded-full bg-electric text-white disabled:opacity-40" onClick={() => void send()} disabled={!input.trim()} aria-label="Send"><ArrowUp size={18} /></button>
          )}
        </div>
      </div>
      <p className="text-center text-xs text-muted">Engineer AI can make mistakes. Check torque values, clearances and procedures against the workshop manual.</p>
    </div>
  );

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-4 py-6">
          {empty ? (
            <div className="grid min-h-[55dvh] place-items-center text-center fade-in">
              <div>
                <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-electric text-white"><Sparkles size={22} /></span>
                <p className="text-2xl font-medium">What are we working on?</p>
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-5">
              {chatId && <button onClick={newChat} className="text-sm text-electric">+ Start a new chat</button>}
              {messages.map((m, i) => (
                <div key={i} className={`flex fade-in ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[92%] rounded-2xl px-4 py-3 md:max-w-[88%] ${m.role === "user" ? "bg-electric text-white whitespace-pre-wrap break-words" : "card"}`}>
                    {m.role === "user" ? (
                      m.content
                    ) : m.image ? (
                      <div className="w-[min(36rem,80vw)]"><ImageCard svg={m.image.svg} title={m.image.title} /></div>
                    ) : m.content ? (
                      <>
                        <Markdown>{m.content}</Markdown>
                        {!(busy && i === messages.length - 1) && (
                          <div className="mt-2 flex gap-4">
                            <button className="flex items-center gap-1 text-xs text-muted hover:text-electric" onClick={() => { navigator.clipboard.writeText(m.content); setCopied(i); setTimeout(() => setCopied(null), 1500); }}>
                              {copied === i ? <Check size={13} /> : <Copy size={13} />} {copied === i ? "Copied" : "Copy"}
                            </button>
                            {lastIsAnswer && i === messages.length - 1 && !m.local && (
                              <button className="flex items-center gap-1 text-xs text-muted hover:text-electric" onClick={regenerate}><RefreshCw size={13} /> Regenerate</button>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <span className="inline-flex gap-1 py-1" aria-label="Thinking">
                        <i className="h-2 w-2 animate-bounce rounded-full bg-electric" />
                        <i className="h-2 w-2 animate-bounce rounded-full bg-electric [animation-delay:.15s]" />
                        <i className="h-2 w-2 animate-bounce rounded-full bg-electric [animation-delay:.3s]" />
                      </span>
                    )}
                  </div>
                </div>
              ))}
              <div ref={endRef} />
            </div>
          )}
        </div>
      </div>
      {<div className="shrink-0 bg-app/95 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">{composer}</div>}
    </div>
  );
}
