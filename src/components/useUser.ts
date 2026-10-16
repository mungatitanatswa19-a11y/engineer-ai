"use client";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabaseBrowser, supabaseConfigured } from "@/lib/supabase/client";

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [name, setName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      return;
    }
    const sb = supabaseBrowser();
    let active = true;

    async function load(u: User | null) {
      if (!active) return;
      setUser(u);
      if (u) {
        const { data } = await sb.from("profiles").select("role, display_name").eq("id", u.id).single();
        if (!active) return;
        setIsAdmin(data?.role === "admin");
        setName(data?.display_name ?? u.email ?? "");
      } else {
        setIsAdmin(false);
        setName("");
      }
      setLoading(false);
    }

    sb.auth.getUser().then(({ data }) => load(data.user ?? null));
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => {
      load(session?.user ?? null);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, isAdmin, name, loading };
}
