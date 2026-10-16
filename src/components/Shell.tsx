"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BookOpen, Calculator, Cog, History, Image as ImageIcon, Info, LogIn, LogOut, Mail, Menu, MessageSquarePlus,
  Moon, PanelLeftClose, PanelLeftOpen, Search, ShieldCheck, Sparkles, Sun, Upload, User as UserIcon, Wrench, X, Bookmark,
} from "lucide-react";
import { useUser } from "./useUser";
import { ABOUT_TAGLINE, ABOUT_TEXT, SUGGESTED } from "@/lib/suggest";
import { SUBJECTS } from "@/lib/types";
import { supabaseBrowser, supabaseConfigured } from "@/lib/supabase/client";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ size?: number }> };

const TOOLS: NavItem[] = [
  { href: "/images", label: "Image Studio", icon: ImageIcon },
  { href: "/tools", label: "Study Tools", icon: Wrench },
  { href: "/calculators", label: "Calculators", icon: Calculator },
  { href: "/library", label: "Question Papers", icon: BookOpen },
  { href: "/upload", label: "Upload & Solve", icon: Upload },
];
const ACCOUNT: NavItem[] = [
  { href: "/history", label: "Chat History", icon: History },
  { href: "/saved", label: "Saved Papers", icon: Bookmark },
  { href: "/profile", label: "Settings & Profile", icon: Cog },
  { href: "/about", label: "About", icon: Info },
  { href: "/contact", label: "Contact & Feedback", icon: Mail },
];

type RecentChat = { id: string; title: string };

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { user, isAdmin, name } = useUser();
  const [open, setOpen] = useState(false); // mobile drawer
  const [collapsed, setCollapsed] = useState(false); // desktop
  const [dark, setDark] = useState(false);
  const [acct, setAcct] = useState(false);
  const [recent, setRecent] = useState<RecentChat[]>([]);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    try { setCollapsed(localStorage.getItem("side") === "closed"); } catch {}
  }, []);
  useEffect(() => { setOpen(false); setAcct(false); }, [path]);

  useEffect(() => {
    if (!user || !supabaseConfigured) { setRecent([]); return; }
    let live = true;
    supabaseBrowser().from("chats").select("id, title").order("updated_at", { ascending: false }).limit(14)
      .then(({ data }) => live && setRecent((data as RecentChat[]) ?? []));
    return () => { live = false; };
  }, [user, path]);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch {}
  }
  function toggleSide() {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem("side", next ? "closed" : "open"); } catch {}
  }
  async function logout() {
    await supabaseBrowser().auth.signOut();
    router.push("/");
    router.refresh();
  }

  const link = (n: NavItem) => {
    const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
    const Icon = n.icon;
    return (
      <Link key={n.href} href={n.href} className={`flex items-center gap-3 rounded-xl px-3 min-h-10 text-sm font-medium transition ${active ? "bg-white/15 text-white" : "text-slate-200 hover:bg-white/10"}`}>
        <Icon size={18} /> {n.label}
      </Link>
    );
  };

  const sidebar = (
    <div className="flex h-full flex-col bg-navy text-white">
      <div className="flex h-14 shrink-0 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-electric"><Sparkles size={16} /></span>
          <span className="text-lg font-extrabold tracking-wide">ENGINEER <span className="text-electric">AI</span></span>
        </Link>
        <button onClick={toggleSide} aria-label="Collapse sidebar" className="hidden h-9 w-9 place-items-center rounded-lg hover:bg-white/10 md:grid"><PanelLeftClose size={18} /></button>
      </div>

      <div className="space-y-1 px-3 pb-2">
        <Link href="/" className="flex items-center gap-3 rounded-xl bg-white/10 px-3 min-h-10 text-sm font-semibold hover:bg-white/15"><MessageSquarePlus size={18} /> New chat</Link>
        <Link href="/history" className="flex items-center gap-3 rounded-xl px-3 min-h-10 text-sm text-slate-200 hover:bg-white/10"><Search size={18} /> Search chats</Link>
      </div>

      <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 pb-3" aria-label="Main">
        <div>
          <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Tools</p>
          <div className="space-y-0.5">{TOOLS.map(link)}</div>
        </div>
        <div className="space-y-0.5">
          <details className="group rounded-xl">
            <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl px-3 min-h-10 text-sm hover:bg-white/10">About Engineer AI <span className="text-slate-400 group-open:hidden">+</span><span className="hidden text-slate-400 group-open:inline">−</span></summary>
            <div className="px-3 pb-2 text-[13px] leading-relaxed text-slate-300"><b className="mb-1 block text-white">{ABOUT_TAGLINE}</b>{ABOUT_TEXT}<Link href="/about" className="mt-2 block text-electric underline">More about Engineer AI</Link></div>
          </details>
          <details className="group rounded-xl">
            <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl px-3 min-h-10 text-sm hover:bg-white/10">Try asking <span className="text-slate-400 group-open:hidden">+</span><span className="hidden text-slate-400 group-open:inline">−</span></summary>
            <div className="space-y-0.5 pb-2">{SUGGESTED.map((q) => (<Link key={q} href={`/?q=${encodeURIComponent(q)}`} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-1.5 text-[13px] leading-snug text-slate-300 hover:bg-white/10">{q}</Link>))}</div>
          </details>
          <details className="group rounded-xl">
            <summary className="flex cursor-pointer list-none items-center justify-between rounded-xl px-3 min-h-10 text-sm hover:bg-white/10">Popular subjects <span className="text-slate-400 group-open:hidden">+</span><span className="hidden text-slate-400 group-open:inline">−</span></summary>
            <div className="flex flex-wrap gap-1.5 px-3 pb-2">{SUBJECTS.slice(0, 12).map((x) => (<Link key={x} href={`/?q=${encodeURIComponent("Teach me the basics of " + x)}`} onClick={() => setOpen(false)} className="rounded-full border border-white/20 px-2.5 py-1 text-xs text-slate-200 hover:bg-white/10">{x}</Link>))}</div>
          </details>
        </div>
        <div>
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Recent chats</p>
          {user ? (
            recent.length ? (
              <ul className="space-y-0.5">
                {recent.map((c) => (
                  <li key={c.id}><Link href={`/?chat=${c.id}`} className="block truncate rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/10">{c.title}</Link></li>
                ))}
              </ul>
            ) : <p className="px-3 text-sm text-slate-400">Your conversations will appear here.</p>
          ) : (
            <p className="px-3 text-sm text-slate-400"><Link href="/login" className="text-electric underline">Sign in</Link> to keep your chat history.</p>
          )}
        </div>
      </nav>

      <div className="relative border-t border-white/10 p-3">
        {acct && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setAcct(false)} />
            <div role="menu" className="absolute bottom-[4.25rem] left-3 right-3 z-50 space-y-0.5 rounded-2xl border border-white/10 bg-navy2 p-1.5 shadow-xl fade-in">
              {ACCOUNT.map(link)}
              {isAdmin && link({ href: "/admin", label: "Admin Dashboard", icon: ShieldCheck })}
              <button onClick={toggleTheme} className="flex w-full items-center gap-3 rounded-xl px-3 min-h-10 text-sm text-slate-200 hover:bg-white/10">
                {dark ? <Sun size={18} /> : <Moon size={18} />} {dark ? "Light mode" : "Dark mode"}
              </button>
              {user && <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 min-h-10 text-sm text-slate-200 hover:bg-white/10"><LogOut size={18} /> Sign out</button>}
            </div>
          </>
        )}
        {user ? (
          <button onClick={() => setAcct((o) => !o)} aria-haspopup="menu" aria-expanded={acct} className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-white/10">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-electric"><UserIcon size={16} /></span>
            <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{name || user.email}</span><span className="block text-xs text-slate-400">{isAdmin ? "Admin" : "Student"}</span></span>
          </button>
        ) : (
          <div className="space-y-2">
            <Link href="/login" className="btn btn-primary w-full"><LogIn size={16} /> Sign in / Sign up</Link>
            <button onClick={() => setAcct((o) => !o)} className="flex w-full items-center gap-3 rounded-xl px-3 min-h-10 text-sm text-slate-300 hover:bg-white/10"><Cog size={18} /> More</button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh">
      <aside className={`hidden shrink-0 md:block ${collapsed ? "md:hidden" : "w-72"}`}>{sidebar}</aside>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 max-w-[85vw] fade-in">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-line bg-card px-3 md:border-0 md:bg-transparent">
          <div className="flex items-center gap-1">
            <button onClick={() => setOpen((o) => !o)} aria-label="Open menu" className="grid h-11 w-11 place-items-center rounded-lg md:hidden">{open ? <X size={22} /> : <Menu size={22} />}</button>
            {collapsed && <button onClick={toggleSide} aria-label="Open sidebar" className="hidden h-10 w-10 place-items-center rounded-lg hover:bg-electric/10 md:grid"><PanelLeftOpen size={20} /></button>}
            <span className="font-extrabold md:hidden">Engineer <span className="text-electric">AI</span></span>
          </div>
          <button onClick={toggleTheme} aria-label="Toggle theme" className="grid h-11 w-11 place-items-center rounded-lg hover:bg-electric/10">{dark ? <Sun size={20} /> : <Moon size={20} />}</button>
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
