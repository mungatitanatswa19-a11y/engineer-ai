"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRightLeft, Sparkles } from "lucide-react";
import { CALCS, UNITS, convert, fmt } from "@/lib/calcs";

export default function CalculatorsPage() {
  const [id, setId] = useState("cr");
  const [vals, setVals] = useState<Record<string, Record<string, string>>>({});
  const [conv, setConv] = useState({ cat: "Pressure", v: "1", from: "bar", to: "psi" });

  const calc = CALCS.find((c) => c.id === id);
  const cur = useMemo<Record<string, string>>(() => {
    if (!calc) return {};
    const o: Record<string, string> = {};
    calc.fields.forEach((f) => (o[f.key] = vals[calc.id]?.[f.key] ?? String(f.def)));
    return o;
  }, [calc, vals]);
  const nums = useMemo<Record<string, number>>(() => Object.fromEntries(Object.entries(cur).map(([k, v]) => [k, parseFloat(String(v))])), [cur]);
  const result = calc ? calc.run(nums) : null;
  const units = Object.keys(UNITS[conv.cat]);
  const cv = parseFloat(conv.v);

  const explain = calc && result
    ? `Explain step by step how this "${calc.title}" calculation works and sanity-check the result. Inputs: ${calc.fields.map((f) => `${f.label} = ${cur[f.key]}${f.unit ? " " + f.unit : ""}`).join(", ")}. Result: ${result.rows.map((r) => `${r[0]}: ${r[1]}`).join("; ")}.`
    : "";

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-muted">Calculators</p>
        <h1 className="text-3xl font-extrabold">Engineering Calculators</h1>
        <p className="mt-1 text-muted">Worked formulas for common workshop calculations. They run on your device and need no sign-in.</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {CALCS.map((c) => (
          <button key={c.id} onClick={() => setId(c.id)} className={`rounded-full border px-3 py-1.5 text-sm font-medium ${id === c.id ? "border-electric bg-electric text-white" : "border-line"}`}>{c.title}</button>
        ))}
        <button onClick={() => setId("conv")} className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-medium ${id === "conv" ? "border-electric bg-electric text-white" : "border-line"}`}><ArrowRightLeft size={14} /> Unit converter</button>
      </div>

      <section className="card space-y-3 p-4">
        {id === "conv" ? (
          <>
            <label className="block text-sm font-semibold">Quantity
              <select className="input mt-1 font-normal" value={conv.cat} onChange={(e) => { const cat = e.target.value; const u = Object.keys(UNITS[cat]); setConv({ ...conv, cat, from: u[0], to: u[1] ?? u[0] }); }}>
                {Object.keys(UNITS).map((k) => <option key={k}>{k}</option>)}
              </select>
            </label>
            <label className="block text-sm font-semibold">Value
              <input className="input mt-1 font-normal" type="number" step="any" value={conv.v} onChange={(e) => setConv({ ...conv, v: e.target.value })} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold">From<select className="input mt-1 font-normal" value={conv.from} onChange={(e) => setConv({ ...conv, from: e.target.value })}>{units.map((u) => <option key={u}>{u}</option>)}</select></label>
              <label className="text-sm font-semibold">To<select className="input mt-1 font-normal" value={conv.to} onChange={(e) => setConv({ ...conv, to: e.target.value })}>{units.map((u) => <option key={u}>{u}</option>)}</select></label>
            </div>
            <p className="rounded-xl bg-electric/10 p-3 text-lg font-bold" aria-live="polite">
              {isFinite(cv) ? `${fmt(cv, 6)} ${conv.from} = ${fmt(convert(conv.cat, cv, conv.from, conv.to), 6)} ${conv.to}` : "Enter a value to convert."}
            </p>
          </>
        ) : (
          calc && (
            <>
              <p className="text-sm text-muted">{calc.desc}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {calc.fields.map((f) =>
                  f.options ? (
                    <label key={f.key} className="text-sm font-semibold">{f.label}
                      <select className="input mt-1 font-normal" value={cur[f.key]} onChange={(e) => setVals({ ...vals, [calc.id]: { ...vals[calc.id], [f.key]: e.target.value } })}>
                        {f.options.map((o, i) => <option key={o} value={i}>{o}</option>)}
                      </select>
                    </label>
                  ) : (
                    <label key={f.key} className="text-sm font-semibold">{f.label}{f.unit ? ` (${f.unit})` : ""}
                      <input className="input mt-1 font-normal" type="number" step="any" inputMode="decimal" value={cur[f.key]} onChange={(e) => setVals({ ...vals, [calc.id]: { ...vals[calc.id], [f.key]: e.target.value } })} />
                    </label>
                  )
                )}
              </div>
              {result ? (
                <div aria-live="polite" className="space-y-3">
                  <table className="w-full text-sm">
                    <tbody>{result.rows.map((r, i) => <tr key={i} className="border-t border-line"><td className="py-2 pr-3 text-muted">{r[0]}</td><td className="py-2 text-right font-bold">{r[1]}</td></tr>)}</tbody>
                  </table>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-muted">{result.steps.map((s, i) => <li key={i}>{s}</li>)}</ul>
                  <Link href={`/?q=${encodeURIComponent(explain)}`} className="btn btn-ghost"><Sparkles size={16} /> Explain this with Engineer AI</Link>
                </div>
              ) : (
                <p className="text-sm text-muted">Enter valid positive numbers to see the result.</p>
              )}
            </>
          )
        )}
      </section>
    </div>
  );
}
