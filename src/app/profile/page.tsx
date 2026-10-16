"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useUser } from "@/components/useUser";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function ProfilePage() {
  const { user, name, isAdmin, loading } = useUser();
  const [displayName, setDisplayName] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => setDisplayName(name), [name]);

  async function save() {
    if (!user) return;
    const { error } = await supabaseBrowser().from("profiles").update({ display_name: displayName.trim().slice(0, 60) }).eq("id", user.id);
    setMsg(error ? "Could not save." : "Saved.");
  }

  if (loading) return <p className="p-6 text-muted">Loading…</p>;
  if (!user)
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-extrabold">Sign in to view your profile</h1>
        <Link href="/login" className="btn btn-primary mt-6">Sign in / Sign up</Link>
      </div>
    );

  return (
    <div className="mx-auto max-w-xl space-y-5 px-4 py-6">
      <h1 className="text-3xl font-extrabold">Profile &amp; Settings</h1>
      <div className="card space-y-3 p-5">
        <p className="text-sm text-muted">Email: <span className="text-ink">{user.email}</span> {isAdmin && <span className="ml-2 rounded bg-electric/10 px-2 py-0.5 text-xs font-bold text-electric">Admin</span>}</p>
        <label className="block text-sm font-medium">Display name
          <input className="input mt-1" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} />
        </label>
        <button className="btn btn-primary" onClick={save}>Save</button>
        {msg && <p className="text-sm text-muted" role="status">{msg}</p>}
      </div>
      <div className="card space-y-2 p-5 text-sm">
        <h2 className="font-bold">Your privacy</h2>
        <p className="text-muted">Chats and private uploads are visible only to you. A paper becomes public only when you choose Publish and confirm. You can make it private again or delete it any time under Saved Papers → My uploads.</p>
      </div>
    </div>
  );
}
