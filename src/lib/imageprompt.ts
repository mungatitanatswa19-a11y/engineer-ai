export const IMAGE_STYLES: Record<string, { label: string; text: string }> = {
  labelled: { label: "Labelled diagram", text: "Clean flat technical illustration with subtle metal shading" },
  cutaway: { label: "Cutaway view", text: "Sectional cutaway that shows the internal construction, with hatching on cut surfaces" },
  exploded: { label: "Exploded view", text: "Exploded assembly view with parts separated along their axis and dashed alignment lines" },
  schematic: { label: "Schematic", text: "Schematic using conventional engineering symbols (hydraulic, pneumatic or electrical as appropriate) with flow arrows" },
  blueprint: { label: "Blueprint", text: "Blueprint style: white and light-cyan linework on a deep blue (#0b2a6b) background with a faint grid, plus dimension lines" },
};

export const IMAGE_PRESETS = [
  "Diesel fuel injector (cutaway)", "Piston and connecting rod assembly", "Single-plate clutch assembly",
  "Differential and crown wheel", "Hydraulic jack", "Disc brake caliper", "Turbocharger", "Synchromesh gearbox",
  "Alternator", "Radiator and cooling circuit", "Vernier caliper", "Torque wrench",
];

export function imagePrompt(subject: string, style: string, high: boolean) {
  const st = IMAGE_STYLES[style] ?? IMAGE_STYLES.labelled;
  return `You are a technical illustrator for engineering students. Draw the following as ONE SVG image.

SUBJECT: ${subject.slice(0, 600)}
STYLE: ${st.label}. ${st.text}.

Rules:
- Reply with ONLY the SVG markup, starting with <svg and ending with </svg>. No markdown fences, no commentary.
- Use viewBox="0 0 1000 700" and xmlns="http://www.w3.org/2000/svg". Do not set width or height.
- First draw a full-canvas background rect (${style === "blueprint" ? "deep blue #0b2a6b" : "white"}).
- Build it from basic shapes (path, rect, circle, ellipse, line, polyline, polygon, g). Use linearGradient or radialGradient in <defs> for metal shading. Use presentation attributes (fill, stroke, stroke-width). Do NOT use <style>, <script>, <image>, <foreignObject>, filters or any external reference.
- Add a title at the top centre (font-size 28), numbered callout circles (r=14) with thin leader lines touching the parts, and a legend listing every number with its part name (font-size 16 to 18).
- All text uses font-family="Arial, Helvetica, sans-serif". Keep every label inside the canvas, readable and not overlapping.
- Be accurate for a diesel plant fitting or automotive student: correct parts in a correct relative arrangement. If you are unsure of a detail, simplify rather than invent parts.
- Detail: ${high ? "12 to 18 labelled parts, richer shading and finer construction detail" : "8 to 12 labelled parts"}. Keep the SVG under ${high ? "30000" : "18000"} characters.`;
}
