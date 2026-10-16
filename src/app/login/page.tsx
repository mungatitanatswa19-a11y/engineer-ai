"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser, supabaseConfigured } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (!supabaseConfigured) {
      setMsg({ ok: false, text: "Supabase is not configured yet. Add the keys from .env.example." });
      return;
    }
    if (password.length < 8) {
      setMsg({ ok: false, text: "Password must be at least 8 characters." });
      return;
    }
    setBusy(true);
    const sb = supabaseBrowser();
    if (mode === "in") {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return setMsg({ ok: false, text: error.message });
      router.push("/");
      router.refresh();
    } else {
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: displayName || email.split("@")[0] },
          emailRedirectTo: `${location.origin}/auth/callback`,
        },
      });
      setBusy(false);
      if (error) return setMsg({ ok: false, text: error.message });
      if (data.session) {
        router.push("/");
        router.refresh();
      } else {
        setMsg({ ok: true, text: "Account created. Check your email to confirm, then sign in." });
      }
    }
  }

  return (
    <div className="mx-auto flex min-h-full max-w-md items-center px-4 py-10">
      <form onSubmit={submit} className="card w-full space-y-4 p-6 fade-in">
        <h1 className="text-2xl font-extrabold">{mode === "in" ? "Welcome back" : "Create your account"}</h1>
        <p className="text-sm text-muted">
          You don&apos;t need an account to chat or browse the question paper library. An account lets you upload papers,
          save materials and keep your chat history.
        </p>
        {mode === "up" && (
          <label className="block text-sm font-medium">Display name
            <input className="input mt-1" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </label>
        )}
        <label className="block text-sm font-medium">Email
          <input className="input mt-1" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block text-sm font-medium">Password
          <input className="input mt-1" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {msg && <p role="alert" className={`text-sm ${msg.ok ? "text-green-600" : "text-red-500"}`}>{msg.text}</p>}
        <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Please wait…" : mode === "in" ? "Sign in" : "Sign up"}</button>
        <button type="button" className="w-full text-sm text-electric" onClick={() => { setMode(mode === "in" ? "up" : "in"); setMsg(null); }}>
          {mode === "in" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}
