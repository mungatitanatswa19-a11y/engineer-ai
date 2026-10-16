"use client";
import { useState } from "react";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [state, setState] = useState<"idle" | "busy" | "done" | string>("idle");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    const res = await fetch("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (res.ok) setState("done");
    else setState((await res.json().catch(() => ({}))).error || "Could not send your message.");
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-8">
      <h1 className="text-3xl font-extrabold">Contact &amp; Feedback</h1>
      <p className="mt-1 text-muted">Found a bug, have an idea, or want a new course added? Tell us.</p>
      {state === "done" ? (
        <p className="card mt-6 p-5">Thank you! Your message was sent.</p>
      ) : (
        <form onSubmit={send} className="card mt-6 space-y-3 p-5">
          <label className="block text-sm font-medium">Name (optional)<input className="input mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label className="block text-sm font-medium">Email (optional)<input className="input mt-1" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          <label className="block text-sm font-medium">Message *<textarea className="input mt-1 min-h-32" required minLength={5} maxLength={3000} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} /></label>
          {state !== "idle" && state !== "busy" && <p role="alert" className="text-sm text-red-500">{state}</p>}
          <button className="btn btn-primary w-full" disabled={state === "busy"}>{state === "busy" ? "Sending…" : "Send message"}</button>
        </form>
      )}
    </div>
  );
}
