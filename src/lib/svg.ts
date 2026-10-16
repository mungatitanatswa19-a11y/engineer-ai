// Allow-list SVG sanitizer. Pure string processing (no DOM), so it runs on the server before
// anything is stored and again in the browser before display. Output is always rendered through
// <img>, which never runs scripts, but we still strip everything dangerous.

const ALLOWED = [
  "svg", "g", "defs", "title", "desc", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
  "text", "tspan", "linearGradient", "radialGradient", "stop", "clipPath", "pattern", "marker", "symbol", "use", "mask",
];
const CANON = new Map(ALLOWED.map((n) => [n.toLowerCase(), n]));
const MAX_IN = 300_000;

const TOKEN =
  /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<![^>]*>|<(\/?)([A-Za-z][\w:.-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'>]+))?)*)\s*(\/?)>|[^<]+|</g;
const ATTR = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
const ATTR_NAME = /^(xlink:href|xml:space|[a-zA-Z][\w-]*)$/;

function cleanValue(name: string, v: string): string | null {
  const n = name.toLowerCase();
  if (/&(?!(amp|lt|gt|quot|apos);)/.test(v)) return null; // no numeric/named entities that could hide payloads
  if (n === "href" || n === "xlink:href") return v.trim().startsWith("#") ? v.trim() : null;
  if (/url\(\s*['"]?\s*(?!#)/i.test(v)) return null;
  if (/javascript:|vbscript:|expression\(|@import|data:|<|\\/i.test(v)) return null;
  return v.replace(/"/g, "&quot;");
}

function cleanText(t: string) {
  return t.replace(/&(?!(amp|lt|gt|quot|apos);)/g, "&amp;").replace(/>/g, "&gt;");
}

/** Returns a safe, self-contained SVG string, or null if the input is not a usable drawing. */
export function cleanSvg(input: string): string | null {
  const src = String(input ?? "");
  const start = src.search(/<svg[\s>]/i);
  const end = src.toLowerCase().lastIndexOf("</svg>");
  if (start < 0 || end < start) return null;
  const raw = src.slice(start, end + 6);
  if (raw.length > MAX_IN) return null;

  const out: string[] = [];
  const stack: { name: string; kept: boolean }[] = [];
  let skip = 0; // number of dropped ancestors currently open
  let sawRoot = false;
  let shapes = 0;
  let rootViewBox = "";
  let rootW = NaN;
  let rootH = NaN;

  TOKEN.lastIndex = 0;
  for (let m: RegExpExecArray | null; (m = TOKEN.exec(raw)); ) {
    const tok = m[0];
    if (m[2] === undefined) {
      if (tok.startsWith("<") || skip) continue; // comments, CDATA, PIs, stray "<"
      if (stack.length) out.push(cleanText(tok));
      continue;
    }
    const closing = m[1] === "/";
    const lower = m[2].toLowerCase();
    const canon = CANON.get(lower);

    if (closing) {
      let i = stack.length - 1;
      while (i >= 0 && stack[i].name !== lower) i--;
      if (i < 0) continue;
      while (stack.length > i) {
        const top = stack.pop()!;
        if (!top.kept) skip--;
        else if (!skip) out.push(`</${CANON.get(top.name)}>`);
      }
      continue;
    }

    const selfClose = m[4] === "/";
    const isRoot = lower === "svg" && !sawRoot && stack.length === 0;
    const keep = !!canon && !skip && (lower !== "svg" || isRoot);

    if (!selfClose) {
      stack.push({ name: lower, kept: keep });
      if (!keep) skip++;
    }
    if (!keep) {
      if (selfClose) continue;
      continue;
    }

    const attrs: string[] = [];
    ATTR.lastIndex = 0;
    for (let a: RegExpExecArray | null; (a = ATTR.exec(m[3] ?? "")); ) {
      const name = a[1];
      const val = a[2] ?? a[3] ?? a[4] ?? "";
      if (!ATTR_NAME.test(name) || /^on/i.test(name)) continue;
      if (isRoot) {
        if (name === "viewBox") rootViewBox = val;
        if (name === "width") rootW = parseFloat(val);
        if (name === "height") rootH = parseFloat(val);
        if (/^(viewBox|width|height|xmlns|version|id|class)$/i.test(name)) continue;
      }
      if (/^(xmlns|class|id)$/i.test(name) && !isRoot) {
        if (name.toLowerCase() === "xmlns") continue;
      }
      const v = cleanValue(name, val);
      if (v === null) continue;
      attrs.push(`${name}="${v}"`);
    }

    if (isRoot) {
      sawRoot = true;
      let vb = rootViewBox.trim();
      if (!/^-?[\d.]+[\s,]+-?[\d.]+[\s,]+[\d.]+[\s,]+[\d.]+$/.test(vb)) {
        vb = `0 0 ${rootW > 0 ? rootW : 1000} ${rootH > 0 ? rootH : 700}`;
      }
      out.push(
        `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="${vb}"${attrs.length ? " " + attrs.join(" ") : ""}>`
      );
      continue;
    }
    if (["text", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon"].includes(lower)) shapes++;
    out.push(`<${canon}${attrs.length ? " " + attrs.join(" ") : ""}${selfClose ? "/" : ""}>`);
  }

  if (!sawRoot || shapes < 3) return null;
  // Close anything left open (including the root).
  while (stack.length) {
    const top = stack.pop()!;
    if (top.kept) out.push(`</${CANON.get(top.name)}>`);
  }
  return out.join("");
}

export function svgDataUrl(svg: string) {
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
