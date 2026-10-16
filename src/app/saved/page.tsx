"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import PaperCard from "@/components/PaperCard";
import { useUser } from "@/components/useUser";
import { supabaseBrowser, supabaseConfigured } from "@/lib/supabase/client";
import type { Paper } from "@/lib/types";

export default function SavedPage() {
  const { user, loading } = useUser();
  const [tab, setTab] = useState<"saved" | "mine">("saved");
  const [saved, setSaved] = useState<Paper[]>([]);
  const [mine, setMine] = useState<Paper[]>([]);
  const [busy, setBusy] = useState(true);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    if (!user || !supabaseConfigured) return setBusy(false);
    const sb = supabaseBrowser();
    const [s, m] = await Promise.all([
      sb.from("paper_saves").select("papers(*)").eq("user_id", user.id).order("created_at", { ascending: false }),
      sb.from("papers").select("*").eq("uploader_id", user.id).order("created_at", { ascending: false }),
    ]);
    setSaved(((s.data ?? []) as unknown as { papers: Paper | null }[]).map((r) => r.papers).filter((p): p is Paper => Boolean(p)));
    setMine((m.data as Paper[]) ?? []);
    setBusy(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  async function act(id: string, action: "unpublish" | "delete") {
    setMsg("");
    if (action === "delete" && !confirm("Delete this paper permanently?")) return;
    const res = await fetch(`/api/papers/${id}`, action === "delete"
      ? { method: "DELETE" }
      : { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    if (!res.ok) setMsg((await res.json().catch(() => ({}))).error || "Action failed.");
    load();
  }

  if (loading) return <p className="p-6 text-muted">Loading…</p>;
  if (!user)
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-extrabold">Sign in to see your papers</h1>
        <Link href="/login" className="btn btn-primary mt-6">Sign in / Sign up</Link>
      </div>
    );

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6">
      <h1 className="text-3xl font-extrabold">Saved Papers</h1>
      <div className="flex gap-2">
        <button className={`btn ${tab === "saved" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab("saved")}>Saved ({saved.length})</button>
        <button className={`btn ${tab === "mine" ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab("mine")}>My uploads ({mine.length})</button>
      </div>
      {msg && <p role="alert" className="text-sm text-red-500">{msg}</p>}
      {busy && <p className="text-muted">Loading…</p>}

      {!busy && tab === "saved" && (saved.length === 0 ? (
        <p className="card p-6 text-sm text-muted">Nothing saved yet. Use the bookmark button on any paper in the <Link className="text-electric" href="/library">library</Link>.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {saved.map((p) => <PaperCard key={p.id} paper={p} saved onSavedChange={() => load()} />)}
        </div>
      ))}

      {!busy && tab === "mine" && (mine.length === 0 ? (
        <p className="card p-6 text-sm text-muted">You haven&apos;t uploaded anything yet. <Link className="text-electric" href="/upload">Upload a paper</Link>.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {mine.map((p) => (
            <div key={p.id} className="space-y-2">
              <PaperCard paper={p} canSave={false} />
              <div className="flex gap-2 text-sm">
                {(p.status === "published" || p.status === "pending") && <button className="btn btn-ghost !min-h-9 !px-3" onClick={() => act(p.id, "unpublish")}>Make private</button>}
                <button className="btn btn-ghost !min-h-9 !px-3 text-red-500" onClick={() => act(p.id, "delete")}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
