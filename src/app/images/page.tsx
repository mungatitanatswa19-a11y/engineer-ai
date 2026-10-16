"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Image as ImageIcon, Loader2, Square, Trash2 } from "lucide-react";
import ImageCard from "@/components/ImageCard";
import { useUser } from "@/components/useUser";
import { IMAGE_PRESETS, IMAGE_STYLES } from "@/lib/imageprompt";
import { errorText } from "@/lib/stream";
import { supabaseBrowser, supabaseConfigured } from "@/lib/supabase/client";

type Img = { id: string | null; title: string; svg: string };

export default function ImagesPage() {
  const { user } = useUser();
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("labelled");
  const [detail, setDetail] = useState("standard");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Img | null>(null);
  const [gallery, setGallery] = useState<Img[]>([]);
  const ctl = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    if (!user || !supabaseConfigured) return setGallery([]);
    const { data } = await supabaseBrowser().from("images").select("id, title, svg").order("created_at", { ascending: false }).limit(40);
    setGallery((data as Img[]) ?? []);
  }, [user]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("prompt");
    if (p) setPrompt(p);
  }, []);

  async function generate() {
    if (busy || prompt.trim().length < 3) return;
    setBusy(true); setError(""); setResult(null);
    const c = new AbortController();
    ctl.current = c;
    try {
      const res = await fetch("/api/image", {
        method: "POST", signal: c.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, style, detail }),
      });
      if (!res.ok) throw new Error(await errorText(res));
      setResult(await res.json());
      load();
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
      ctl.current = null;
    }
  }

  async function remove(id: string | null) {
    if (!id || !confirm("Delete this image?")) return;
    await supabaseBrowser().from("images").delete().eq("id", id);
    load();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted">Image Studio</p>
        <h1 className="text-3xl font-extrabold">Engineering Image Studio</h1>
        <p className="mt-1 text-muted">Describe a component and Engineer AI draws a labelled diagram you can download. These are AI-drawn vector illustrations, not photographs.</p>
      </header>

      <section className="card space-y-3 p-4">
        <label className="block text-sm font-semibold" htmlFor="imgPrompt">What should it draw?</label>
        <textarea id="imgPrompt" className="input min-h-24" maxLength={600} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. Cutaway of a diesel fuel injector" />
        <div className="flex flex-wrap gap-2">
          {IMAGE_PRESETS.map((p) => (
            <button key={p} onClick={() => setPrompt(p)} className="rounded-full border border-line px-3 py-1.5 text-sm hover:border-electric">{p}</button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">Style
            <select className="input mt-1 font-normal" value={style} onChange={(e) => setStyle(e.target.value)}>
              {Object.entries(IMAGE_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold">Detail
            <select className="input mt-1 font-normal" value={detail} onChange={(e) => setDetail(e.target.value)}>
              <option value="standard">Standard</option>
              <option value="high">High detail (slower)</option>
            </select>
          </label>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-primary" onClick={generate} disabled={busy || prompt.trim().length < 3}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />} {busy ? "Drawing…" : "Generate image"}
          </button>
          {busy && <button className="btn btn-ghost" onClick={() => ctl.current?.abort()}><Square size={14} /> Stop</button>}
        </div>
        {error && <p role="alert" className="text-sm text-red-500">{error}</p>}
        {!user && <p className="text-xs text-muted">Guests can create a few images. <Link href="/login" className="text-electric">Sign in</Link> to create more and keep a private gallery.</p>}
      </section>

      {busy && <div className="card grid aspect-[10/7] place-items-center animate-pulse text-sm text-muted">Drawing your diagram… this can take up to a minute.</div>}
      {result && !busy && <div className="card p-3"><ImageCard svg={result.svg} title={result.title} /></div>}

      {user && gallery.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold">Your gallery</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {gallery.map((g) => (
              <div key={g.id} className="card p-3">
                <ImageCard svg={g.svg} title={g.title} extra={
                  <button aria-label="Delete image" onClick={() => remove(g.id)} className="grid h-9 w-9 place-items-center rounded-lg text-muted hover:text-red-500"><Trash2 size={15} /></button>
                } />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
