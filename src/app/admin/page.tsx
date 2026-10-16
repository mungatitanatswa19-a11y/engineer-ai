"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useUser } from "@/components/useUser";
import { supabaseBrowser, supabaseConfigured } from "@/lib/supabase/client";
import type { Paper } from "@/lib/types";

type Report = { id: string; reason: string; details: string | null; status: string; created_at: string; papers: { id: string; title: string; status: string } | null };
type Feedback = { id: string; name: string | null; email: string | null; message: string; created_at: string };

export default function AdminPage() {
  const { user, isAdmin, loading } = useUser();
  const [tab, setTab] = useState<"queue" | "reports" | "papers" | "feedback">("queue");
  const [pending, setPending] = useState<Paper[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [stats, setStats] = useState({ published: 0, users: 0, openReports: 0 });
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    if (!isAdmin || !supabaseConfigured) return;
    const sb = supabaseBrowser();
    const [p, r, a, f, pc, uc] = await Promise.all([
      sb.from("papers").select("*").eq("status", "pending").order("created_at"),
      sb.from("reports").select("*, papers(id,title,status)").eq("status", "open").order("created_at", { ascending: false }),
      sb.from("papers").select("*").neq("status", "private").order("created_at", { ascending: false }).limit(100),
      sb.from("feedback").select("*").order("created_at", { ascending: false }).limit(50),
      sb.from("papers").select("id", { count: "exact", head: true }).eq("status", "published"),
      sb.from("profiles").select("id", { count: "exact", head: true }),
    ]);
    setPending((p.data as Paper[]) ?? []);
    setReports((r.data as unknown as Report[]) ?? []);
    setPapers((a.data as Paper[]) ?? []);
    setFeedback((f.data as Feedback[]) ?? []);
    setStats({ published: pc.count ?? 0, users: uc.count ?? 0, openReports: (r.data ?? []).length });
  }, [isAdmin]);

  useEffect(() => { load(); }, [load]);

  async function paperAction(id: string, action: "approve" | "remove" | "restore") {
    setMsg("");
    const res = await fetch(`/api/admin/papers/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    if (!res.ok) setMsg("Action failed.");
    load();
  }
  async function reportAction(id: string, status: "resolved" | "dismissed") {
    await fetch(`/api/admin/reports/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    load();
  }

  if (loading) return <p className="p-6 text-muted">Loading…</p>;
  if (!user || !isAdmin)
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-extrabold">Admins only</h1>
        <p className="mt-2 text-muted">You need an administrator account to view this page.</p>
        <Link href="/" className="btn btn-primary mt-6">Back home</Link>
      </div>
    );

  const tabs = [["queue", `Approval queue (${pending.length})`], ["reports", `Reports (${reports.length})`], ["papers", "All public papers"], ["feedback", "Feedback"]] as const;

  const Row = ({ p }: { p: Paper }) => (
    <li className="card flex flex-wrap items-center gap-3 p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{p.title}</p>
        <p className="text-xs text-muted">{[p.course, p.subject, p.institution].filter(Boolean).join(" · ")} · {p.status} · {p.report_count} report(s)</p>
      </div>
      <a className="btn btn-ghost !min-h-9 !px-3 text-sm" href={`/api/papers/${p.id}/download?view=1`} target="_blank" rel="noreferrer">View</a>
      {p.status !== "published" && p.status !== "private" && <button className="btn btn-primary !min-h-9 !px-3 text-sm" onClick={() => paperAction(p.id, p.status === "removed" ? "restore" : "approve")}>{p.status === "removed" ? "Restore" : "Approve"}</button>}
      {p.status !== "removed" && <button className="btn btn-ghost !min-h-9 !px-3 text-sm text-red-500" onClick={() => paperAction(p.id, "remove")}>Remove</button>}
    </li>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 py-6">
      <h1 className="text-3xl font-extrabold">Admin Dashboard</h1>
      <div className="grid grid-cols-3 gap-3">
        {[["Published papers", stats.published], ["Users", stats.users], ["Open reports", stats.openReports]].map(([l, v]) => (
          <div key={l} className="card p-4"><p className="text-2xl font-extrabold">{v}</p><p className="text-xs text-muted">{l}</p></div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {tabs.map(([id, label]) => <button key={id} className={`btn ${tab === id ? "btn-primary" : "btn-ghost"}`} onClick={() => setTab(id)}>{label}</button>)}
      </div>
      {msg && <p role="alert" className="text-sm text-red-500">{msg}</p>}

      {tab === "queue" && (pending.length ? <ul className="space-y-2">{pending.map((p) => <Row key={p.id} p={p} />)}</ul> : <p className="card p-6 text-sm text-muted">Nothing waiting for approval. (Set PAPER_MODERATION=on to review every new paper first. Papers with 5+ reports also land here.)</p>)}

      {tab === "reports" && (reports.length ? (
        <ul className="space-y-2">
          {reports.map((r) => (
            <li key={r.id} className="card space-y-2 p-3">
              <p className="font-medium">{r.papers?.title ?? "(deleted paper)"} <span className="ml-2 rounded bg-amber-500/20 px-2 py-0.5 text-xs">{r.reason}</span></p>
              {r.details && <p className="text-sm text-muted">{r.details}</p>}
              <div className="flex flex-wrap gap-2">
                {r.papers && <a className="btn btn-ghost !min-h-9 !px-3 text-sm" href={`/api/papers/${r.papers.id}/download?view=1`} target="_blank" rel="noreferrer">View paper</a>}
                {r.papers && <button className="btn btn-ghost !min-h-9 !px-3 text-sm text-red-500" onClick={() => paperAction(r.papers!.id, "remove")}>Remove paper</button>}
                <button className="btn btn-ghost !min-h-9 !px-3 text-sm" onClick={() => reportAction(r.id, "dismissed")}>Dismiss</button>
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="card p-6 text-sm text-muted">No open reports.</p>)}

      {tab === "papers" && <ul className="space-y-2">{papers.map((p) => <Row key={p.id} p={p} />)}</ul>}

      {tab === "feedback" && (feedback.length ? (
        <ul className="space-y-2">
          {feedback.map((f) => (
            <li key={f.id} className="card p-3">
              <p className="text-sm">{f.message}</p>
              <p className="mt-1 text-xs text-muted">{f.name || "Anonymous"} {f.email && `· ${f.email}`} · {new Date(f.created_at).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      ) : <p className="card p-6 text-sm text-muted">No feedback yet.</p>)}
    </div>
  );
}
