"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Search, SlidersHorizontal, Upload } from "lucide-react";
import PaperCard from "@/components/PaperCard";
import RecentPapers from "@/components/RecentPapers";
import { supabaseBrowser, supabaseConfigured } from "@/lib/supabase/client";
import { COURSES, EXAM_TYPES, SUBJECTS, type Paper } from "@/lib/types";

const PAGE = 12;
const TYPES = [
  ["", "All types"],
  ["application/pdf", "PDF"],
  ["image/png,image/jpeg,image/webp", "Images"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Word (DOCX)"],
  ["text/plain", "Text"],
];

export default function LibraryPage() {
  const [q, setQ] = useState("");
  const [subject, setSubject] = useState("");
  const [course, setCourse] = useState("");
  const [institution, setInstitution] = useState("");
  const [year, setYear] = useState("");
  const [examType, setExamType] = useState("");
  const [docType, setDocType] = useState("");
  const [sort, setSort] = useState<"published_at" | "download_count">("published_at");
  const [showFilters, setShowFilters] = useState(false);

  const [papers, setPapers] = useState<Paper[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<Set<string>>(new Set());

  const filtersActive = Boolean(q || subject || course || institution || year || examType || docType);

  const load = useCallback(
    async (offset: number) => {
      if (!supabaseConfigured) {
        setLoading(false);
        setError("The library backend is not configured yet (see README).");
        return;
      }
      setLoading(true);
      setError("");
      let query = supabaseBrowser().from("papers").select("*", { count: "exact" }).eq("status", "published");
      const term = q.replace(/[,()%*\\]/g, " ").trim();
      if (term) {
        query = query.or(
          ["title", "subject", "course", "institution", "description"].map((c) => `${c}.ilike.%${term}%`).join(",")
        );
      }
      if (subject) query = query.eq("subject", subject);
      if (course) query = query.eq("course", course);
      if (examType) query = query.eq("exam_type", examType);
      if (institution.trim()) query = query.ilike("institution", `%${institution.replace(/[,()%*\\]/g, " ").trim()}%`);
      if (year && Number(year)) query = query.eq("year", Number(year));
      if (docType) query = query.in("file_type", docType.split(","));

      const { data, count, error: err } = await query
        .order(sort, { ascending: false })
        .range(offset, offset + PAGE - 1);
      setLoading(false);
      if (err) return setError("Could not load papers. Please try again.");
      setTotal(count ?? 0);
      setPapers((prev) => (offset === 0 ? ((data as Paper[]) ?? []) : [...prev, ...((data as Paper[]) ?? [])]));
    },
    [q, subject, course, institution, year, examType, docType, sort]
  );

  // debounce search/filters
  useEffect(() => {
    const t = setTimeout(() => load(0), 250);
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    if (!supabaseConfigured) return;
    const sb = supabaseBrowser();
    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) return;
      const { data: rows } = await sb.from("paper_saves").select("paper_id").eq("user_id", data.user.id);
      setSaved(new Set((rows ?? []).map((r) => r.paper_id as string)));
    });
  }, []);

  function reset() {
    setQ(""); setSubject(""); setCourse(""); setInstitution(""); setYear(""); setExamType(""); setDocType("");
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">Question Paper Library</h1>
          <p className="text-muted">Free for everyone. Browse, preview and download papers shared by students. No account needed.</p>
        </div>
        <Link href="/upload" className="btn btn-primary"><Upload size={16} /> Upload a paper</Link>
      </div>

      <div className="card space-y-3 p-3">
        <div className="flex gap-2">
          <label className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input className="input !pl-9" placeholder="Search by title, subject, course or institution…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search papers" />
          </label>
          <button className="btn btn-ghost" onClick={() => setShowFilters((s) => !s)} aria-expanded={showFilters}>
            <SlidersHorizontal size={16} /> <span className="hidden sm:inline">Filters</span>
          </button>
        </div>
        {showFilters && (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 fade-in">
            <select className="input" value={course} onChange={(e) => setCourse(e.target.value)} aria-label="Course">
              <option value="">All courses</option>
              {COURSES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select className="input" value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject">
              <option value="">All subjects</option>
              {SUBJECTS.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select className="input" value={examType} onChange={(e) => setExamType(e.target.value)} aria-label="Exam type">
              <option value="">All exam types</option>
              {EXAM_TYPES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <input className="input" placeholder="Institution" value={institution} onChange={(e) => setInstitution(e.target.value)} />
            <input className="input" type="number" placeholder="Year (e.g. 2024)" value={year} onChange={(e) => setYear(e.target.value)} />
            <select className="input" value={docType} onChange={(e) => setDocType(e.target.value)} aria-label="Document type">
              {TYPES.map(([v, l]) => <option key={l} value={v}>{l}</option>)}
            </select>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-muted">{loading ? "Loading…" : `${total} paper${total === 1 ? "" : "s"}`}</span>
          <div className="flex items-center gap-3">
            {filtersActive && <button className="text-electric" onClick={reset}>Clear filters</button>}
            <select className="input !min-h-9 !w-auto !py-1" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort">
              <option value="published_at">Newest</option>
              <option value="download_count">Most downloaded</option>
            </select>
          </div>
        </div>
      </div>

      {!filtersActive && (
        <>
          <section>
            <h2 className="mb-3 text-lg font-bold">Recently uploaded</h2>
            <RecentPapers limit={4} />
          </section>
          <section>
            <h2 className="mb-3 text-lg font-bold">Popular</h2>
            <RecentPapers limit={4} order="download_count" />
          </section>
          <section>
            <h2 className="mb-3 text-lg font-bold">Recommended study materials</h2>
            <RecentPapers limit={4} order="download_count" examTypes={["Study Notes", "Past Paper"]} />
          </section>
          <h2 className="text-lg font-bold">Browse all papers</h2>
        </>
      )}

      {error && <p role="alert" className="card p-4 text-sm text-red-500">{error}</p>}

      {!error && !loading && papers.length === 0 && (
        <div className="card p-8 text-center">
          <p className="font-semibold">No papers found.</p>
          <p className="mt-1 text-sm text-muted">Try different keywords or clear the filters — or upload one to help others.</p>
          <Link href="/upload" className="btn btn-primary mt-4">Upload a paper</Link>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {papers.map((p) => (
          <PaperCard key={p.id} paper={p} saved={saved.has(p.id)} />
        ))}
      </div>

      {papers.length < total && (
        <div className="text-center">
          <button className="btn btn-ghost" onClick={() => load(papers.length)} disabled={loading}>
            {loading ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  );
}
