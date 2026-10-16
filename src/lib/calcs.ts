export type Field = { key: string; label: string; unit?: string; def: number; options?: string[] };
export type CalcResult = { rows: [string, string][]; steps: string[] };
export type Calc = { id: string; title: string; desc: string; fields: Field[]; run: (v: Record<string, number>) => CalcResult | null };

export function fmt(n: number, d = 2) {
  if (!isFinite(n)) return "–";
  return n.toLocaleString("en-US", { maximumFractionDigits: d, minimumFractionDigits: 0 });
}

export const UNITS: Record<string, Record<string, number>> = {
  Pressure: { bar: 1e5, kPa: 1e3, MPa: 1e6, psi: 6894.757, Pa: 1, atm: 101325 },
  Torque: { "N·m": 1, "lbf·ft": 1.355818, "kgf·m": 9.80665, "lbf·in": 0.1129848 },
  Power: { kW: 1e3, W: 1, "hp (mech)": 745.6999, PS: 735.4988 },
  Length: { mm: 0.001, cm: 0.01, m: 1, in: 0.0254, ft: 0.3048, thou: 2.54e-5 },
  Volume: { "cm³": 0.001, L: 1, "m³": 1000, "in³": 0.016387064, "gal (US)": 3.785412, "gal (UK)": 4.54609 },
  Force: { N: 1, kN: 1e3, kgf: 9.80665, lbf: 4.448222 },
  Temperature: { "°C": 1, "°F": 1, K: 1 },
};

export function convert(cat: string, v: number, from: string, to: string) {
  if (cat === "Temperature") {
    const c = from === "°C" ? v : from === "°F" ? ((v - 32) * 5) / 9 : v - 273.15;
    return to === "°C" ? c : to === "°F" ? (c * 9) / 5 + 32 : c + 273.15;
  }
  const u = UNITS[cat];
  return (v * u[from]) / u[to];
}

export const CALCS: Calc[] = [
  {
    id: "cr", title: "Compression ratio", desc: "Swept volume, displacement, compression ratio",
    fields: [
      { key: "bore", label: "Bore", unit: "mm", def: 100 }, { key: "stroke", label: "Stroke", unit: "mm", def: 110 },
      { key: "cc", label: "Clearance volume (one cylinder)", unit: "cm³", def: 90 }, { key: "cyl", label: "Number of cylinders", def: 4 },
    ],
    run(v) {
      if (!(v.bore > 0 && v.stroke > 0 && v.cc > 0 && v.cyl > 0)) return null;
      const vs = ((Math.PI / 4) * v.bore * v.bore * v.stroke) / 1000, cr = (vs + v.cc) / v.cc;
      return {
        rows: [["Swept volume per cylinder", fmt(vs, 1) + " cm³"], ["Engine displacement", fmt((vs * v.cyl) / 1000, 3) + " L"], ["Compression ratio", fmt(cr, 2) + " : 1"]],
        steps: [`Vs = π/4 × bore² × stroke = π/4 × ${fmt(v.bore)}² × ${fmt(v.stroke)} = ${fmt(vs * 1000, 0)} mm³`, `CR = (Vs + Vc) ÷ Vc = (${fmt(vs, 1)} + ${fmt(v.cc)}) ÷ ${fmt(v.cc)} = ${fmt(cr, 2)}`],
      };
    },
  },
  {
    id: "pow", title: "Power & torque", desc: "Convert between torque, speed and power",
    fields: [
      { key: "mode", label: "Find", def: 0, options: ["Power from torque and speed", "Torque from power and speed"] },
      { key: "torque", label: "Torque", unit: "N·m", def: 400 }, { key: "power", label: "Power", unit: "kW", def: 100 }, { key: "rpm", label: "Engine speed", unit: "rpm", def: 2200 },
    ],
    run(v) {
      if (!(v.rpm > 0)) return null;
      let T: number, P: number;
      if (+v.mode === 0) { if (!(v.torque > 0)) return null; T = v.torque; P = (T * v.rpm) / 9549.3; }
      else { if (!(v.power > 0)) return null; P = v.power; T = (P * 9549.3) / v.rpm; }
      return {
        rows: [["Torque", fmt(T, 1) + " N·m"], ["Power", fmt(P, 1) + " kW"], ["Power (mechanical hp)", fmt(P * 1.34102, 1) + " hp"], ["Torque (lbf·ft)", fmt(T * 0.737562, 1) + " lbf·ft"]],
        steps: ["P (kW) = T (N·m) × N (rpm) ÷ 9549.3", `= ${fmt(T, 1)} × ${fmt(v.rpm, 0)} ÷ 9549.3 = ${fmt(P, 1)} kW`],
      };
    },
  },
  {
    id: "gear", title: "Gear ratio", desc: "Ratio, output speed and output torque",
    fields: [
      { key: "driver", label: "Driver gear teeth", def: 18 }, { key: "driven", label: "Driven gear teeth", def: 54 },
      { key: "rpm", label: "Input speed", unit: "rpm", def: 3000 }, { key: "torque", label: "Input torque", unit: "N·m", def: 120 }, { key: "eff", label: "Efficiency", unit: "%", def: 97 },
    ],
    run(v) {
      if (!(v.driver > 0 && v.driven > 0 && v.rpm > 0 && v.torque > 0 && v.eff > 0 && v.eff <= 100)) return null;
      const r = v.driven / v.driver;
      return {
        rows: [["Gear ratio", fmt(r, 3) + " : 1"], ["Output speed", fmt(v.rpm / r, 1) + " rpm"], ["Output torque", fmt((v.torque * r * v.eff) / 100, 1) + " N·m"]],
        steps: [`Ratio = driven teeth ÷ driver teeth = ${fmt(v.driven)} ÷ ${fmt(v.driver)} = ${fmt(r, 3)}`, "Output speed = input speed ÷ ratio", "Output torque = input torque × ratio × efficiency"],
      };
    },
  },
  {
    id: "hyd", title: "Hydraulic jack", desc: "Pascal’s law: pressure, force and advantage",
    fields: [
      { key: "d1", label: "Small piston diameter", unit: "mm", def: 25 }, { key: "d2", label: "Large piston diameter", unit: "mm", def: 100 }, { key: "f1", label: "Effort force on small piston", unit: "N", def: 200 },
    ],
    run(v) {
      if (!(v.d1 > 0 && v.d2 > 0 && v.f1 > 0)) return null;
      const a1 = (Math.PI / 4) * (v.d1 / 1000) ** 2, a2 = (Math.PI / 4) * (v.d2 / 1000) ** 2, p = v.f1 / a1, f2 = p * a2;
      return {
        rows: [["System pressure", `${fmt(p / 1e5, 2)} bar (${fmt(p / 1e6, 3)} MPa)`], ["Output force", `${fmt(f2, 0)} N (${fmt(f2 / 9.80665, 0)} kgf)`], ["Mechanical advantage", fmt(f2 / v.f1, 2) + " : 1"], ["Small piston stroke per 1 mm lift", fmt((v.d2 / v.d1) ** 2, 1) + " mm"]],
        steps: [`P = F ÷ A = ${fmt(v.f1)} ÷ ${fmt(a1 * 1e6, 1)} mm² = ${fmt(p / 1e5, 2)} bar`, `Output force = P × A(large) = ${fmt(f2, 0)} N`],
      };
    },
  },
  {
    id: "fit", title: "Limits and fits", desc: "Clearance, interference and fit type from limits",
    fields: [
      { key: "hmin", label: "Hole minimum size", unit: "mm", def: 25.0 }, { key: "hmax", label: "Hole maximum size", unit: "mm", def: 25.021 },
      { key: "smin", label: "Shaft minimum size", unit: "mm", def: 24.98 }, { key: "smax", label: "Shaft maximum size", unit: "mm", def: 24.993 },
    ],
    run(v) {
      if (!(v.hmin > 0 && v.hmax >= v.hmin && v.smin > 0 && v.smax >= v.smin)) return null;
      const maxc = v.hmax - v.smin, minc = v.hmin - v.smax;
      const type = minc >= 0 ? "Clearance fit" : maxc <= 0 ? "Interference fit" : "Transition fit";
      return {
        rows: [["Hole tolerance", fmt(v.hmax - v.hmin, 3) + " mm"], ["Shaft tolerance", fmt(v.smax - v.smin, 3) + " mm"], ["Maximum clearance", fmt(maxc, 3) + " mm"], ["Minimum clearance", fmt(minc, 3) + " mm"], ["Fit type", type]],
        steps: [`Max clearance = hole max − shaft min = ${fmt(v.hmax, 3)} − ${fmt(v.smin, 3)}`, `Min clearance = hole min − shaft max = ${fmt(v.hmin, 3)} − ${fmt(v.smax, 3)}`, "Min clearance ≥ 0: clearance fit. Max clearance ≤ 0: interference fit. Otherwise: transition fit."],
      };
    },
  },
  {
    id: "speed", title: "Vehicle speed", desc: "Road speed from engine rpm and gearing",
    fields: [
      { key: "rpm", label: "Engine speed", unit: "rpm", def: 2000 }, { key: "gear", label: "Gearbox ratio", def: 1 },
      { key: "fd", label: "Final drive ratio", def: 4.1 }, { key: "r", label: "Tyre rolling radius", unit: "mm", def: 380 },
    ],
    run(v) {
      if (!(v.rpm > 0 && v.gear > 0 && v.fd > 0 && v.r > 0)) return null;
      const wheel = v.rpm / (v.gear * v.fd), kmh = (wheel * 2 * Math.PI * (v.r / 1000) * 60) / 1000;
      return {
        rows: [["Wheel speed", fmt(wheel, 1) + " rpm"], ["Road speed", fmt(kmh, 1) + " km/h"], ["Road speed", fmt(kmh * 0.621371, 1) + " mph"]],
        steps: [`Wheel rpm = engine rpm ÷ (gear ratio × final drive) = ${fmt(wheel, 1)}`, `Speed = wheel rpm × 2π × radius × 60 ÷ 1000 = ${fmt(kmh, 1)} km/h`],
      };
    },
  },
];
