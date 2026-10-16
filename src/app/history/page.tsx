"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { MessageSquare, Trash2 } from "lucide-react";
import { useUser } from "@/components/useUser";
import { supabaseBrowser, supabaseConfigured } from "@/lib/supabase/client";

type Chat = { id: string; title: string; updated_at: string };

export default function HistoryPage() {
  const { user, loading } = useUser();
  const [chats, setChats] = useState<Chat[]>([]);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    if (!user || !supabaseConfigured) return setBusy(false);
    const { data } = await supabaseBrowser().from("chats").select("id, title, updated_at").order("updated_at", { ascending: false }).limit(200);
    setChats((data as Chat[]) ?? []);
    setBusy(false);
  }, [user]);
  useEffect(() => { load(); }, [load]);

  async function remove(id: string) {
    if (!confirm("Delete this conversation?")) return;
    await supabaseBrowser().from("chats").delete().eq("id", id);
    load();
  }

  if (loading) return <p className="p-6 text-muted">Loading…</p>;
  if (!user)
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-2xl font-extrabold">Sign in to keep chat history</h1>
        <p className="mt-2 text-muted">Guests can chat, but conversations are only saved for signed-in users. Your history is private to you.</p>
        <Link href="/login" className="btn btn-primary mt-6">Sign in / Sign up</Link>
      </div>
    );

  return (
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-6">
      <h1 className="text-3xl font-extrabold">Chat History</h1>
      {busy && <p className="text-muted">Loading…</p>}
      {!busy && chats.length === 0 && <p className="card p-6 text-sm text-muted">No conversations yet. <Link href="/" className="text-electric">Ask your first question</Link>.</p>}
      <ul className="space-y-2">
        {chats.map((c) => (
          <li key={c.id} className="card flex items-center gap-3 p-3">
            <MessageSquare size={18} className="shrink-0 text-electric" />
            <Link href={`/?chat=${c.id}`} className="min-w-0 flex-1">
              <p className="truncate font-medium">{c.title}</p>
              <p className="text-xs text-muted">{new Date(c.updated_at).toLocaleString()}</p>
            </Link>
            <button onClick={() => remove(c.id)} aria-label="Delete chat" className="grid h-10 w-10 place-items-center rounded-lg text-muted hover:text-red-500"><Trash2 size={16} /></button>
          </li>
        ))}
      </ul>
    </div>
  );
}
