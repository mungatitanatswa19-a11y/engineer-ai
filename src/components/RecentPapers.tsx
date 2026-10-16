"use client";
import { useEffect, useState } from "react";
import PaperCard from "./PaperCard";
import { supabaseBrowser, supabaseConfigured } from "@/lib/supabase/client";
import type { Paper } from "@/lib/types";

export default function RecentPapers({
  limit = 4,
  order = "published_at",
  examTypes,
}: {
  limit?: number;
  order?: "published_at" | "download_count";
  examTypes?: string[];
}) {
  const [papers, setPapers] = useState<Paper[] | null>(null);
  const key = examTypes?.join("|") ?? "";

  useEffect(() => {
    if (!supabaseConfigured) return setPapers([]);
    let q = supabaseBrowser().from("papers").select("*").eq("status", "published");
    if (examTypes?.length) q = q.in("exam_type", examTypes);
    q.order(order, { ascending: false })
      .limit(limit)
      .then(({ data }) => setPapers((data as Paper[]) ?? []));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, order, key]);

  if (papers === null) return <p className="text-sm text-muted">Loading…</p>;
  if (!papers.length)
    return <p className="card p-4 text-sm text-muted">Nothing here yet. Upload a paper to get the library started!</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {papers.map((p) => (
        <PaperCard key={p.id} paper={p} />
      ))}
    </div>
  );
}
