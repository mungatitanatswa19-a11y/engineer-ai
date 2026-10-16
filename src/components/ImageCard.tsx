"use client";
import { useMemo } from "react";
import { Download, FileImage } from "lucide-react";
import { cleanSvg, svgDataUrl } from "@/lib/svg";

function save(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
const fileName = (t: string) => (t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "engineering-diagram");

/** Shows a generated diagram. The SVG is sanitised again here and shown through <img>, which cannot run scripts. */
export default function ImageCard({ svg, title, extra }: { svg: string; title: string; extra?: React.ReactNode }) {
  const safe = useMemo(() => cleanSvg(svg), [svg]);
  if (!safe) return <p className="text-sm text-red-500">This drawing could not be displayed.</p>;
  const url = svgDataUrl(safe);

  function png() {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = 2000;
      c.height = 1400;
      const g = c.getContext("2d");
      if (!g) return;
      g.fillStyle = "#fff";
      g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      c.toBlob((b) => b && save(b, fileName(title) + ".png"), "image/png");
    };
    img.src = url;
  }

  return (
    <figure className="space-y-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={title} className="w-full rounded-xl border border-line bg-white" />
      <figcaption className="flex flex-wrap items-center gap-2 text-sm">
        <span className="mr-auto truncate text-muted">{title}</span>
        <button className="btn btn-ghost !min-h-9 !px-3 text-xs" onClick={png}><Download size={14} /> PNG</button>
        <button className="btn btn-ghost !min-h-9 !px-3 text-xs" onClick={() => save(new Blob([safe], { type: "image/svg+xml" }), fileName(title) + ".svg")}>
          <FileImage size={14} /> SVG
        </button>
        {extra}
      </figcaption>
    </figure>
  );
}
