import { CLS } from '../constants/classifications';
import { fmt } from '../utils/format';

export function calcScore(facs) {
  if (!facs.length) return {
    total: 0, override: null, bd: {},
    agg: { tLim: 0, tOut: 0, tOver: 0, funded: 0, live: 0, hist: 0, total: 0, util: 0, baseScore: 0 },
    flags: [],
  };

  const live = facs.filter(f => f.status === "Live");
  const hist = facs.filter(f => f.status !== "Live");
  const funded = facs.filter(f => f.nature === "Funded");
  const liveFunded = funded.filter(f => f.status === "Live");
  const tLim = liveFunded.reduce((s, f) => s + (f.limit || 0), 0);
  const tOut = liveFunded.reduce((s, f) => s + (f.outstanding || 0), 0);
  const tOver = liveFunded.reduce((s, f) => s + (f.overdue || 0), 0);

  // Factor 1: Overdue History (50%)
  let os = 100;
  if (tOut > 0) {
    const r = tOver / tOut;
    os = r === 0 ? 100 : r <= 0.02 ? 85 : r <= 0.05 ? 65 : r <= 0.10 ? 40 : r <= 0.20 ? 20 : r <= 0.30 ? 8 : 0;
  }

  // Factor 2: Utilization Ratio (40%)
  let us = 100;
  if (tLim > 0) {
    const r = tOut / tLim;
    us = r <= 0.10 ? 100 : r <= 0.20 ? 95 : r <= 0.30 ? 90 : r <= 0.40 ? 85 : r <= 0.50 ? 78 : r <= 0.60 ? 68 : r <= 0.70 ? 55 : r <= 0.80 ? 40 : r <= 0.90 ? 22 : r <= 0.95 ? 10 : 0;
  } else if (tOut > 0) {
    us = 0;
  }

  // Factor 3: Facility Mix (10%)
  const hasFun = live.some(f => f.nature === "Funded");
  const hasNF = live.some(f => f.nature === "Non-Funded");
  const ms = hasFun && hasNF ? 100 : hasFun ? 55 : hasNF ? 30 : 50;

  const baseScore = Math.round(os * 0.50 + us * 0.40 + ms * 0.10);

  // Classification Penalty: up to -50 pts
  let tpw = 0, wp = 0;
  facs.forEach(f => {
    const w = f.outstanding || f.limit || 1;
    wp += (CLS[f.classification]?.penalty ?? 0) * w;
    tpw += w;
  });
  const ap = tpw > 0 ? wp / tpw : 0;
  const pp = Math.round(ap * 50);
  let raw = Math.max(0, Math.min(100, baseScore - pp));

  // Hard Overrides
  const flags = [];
  let override = null;

  const liveAdv = live.filter(f => ["SS", "DF", "BL", "BLW"].includes(f.classification));
  if (liveAdv.length) {
    override = "UNACCEPTABLE";
    raw = Math.min(raw, 15);
    liveAdv.forEach(f => flags.push({
      ok: false, critical: true,
      t: "LIVE " + (CLS[f.classification]?.label || f.classification),
      d: f.institution + " (" + f.type + ") \u2014 auto-decline.",
    }));
  }

  const liveSMA = live.filter(f => f.classification === "SMA");
  if (liveSMA.length && override !== "UNACCEPTABLE") {
    if (raw > 59) raw = 59;
    if (!override) override = raw < 40 ? "HIGH" : "ELEVATED";
    liveSMA.forEach(f => flags.push({
      ok: false,
      t: "LIVE SMA",
      d: f.institution + " (" + f.type + ") \u2014 capped at Elevated.",
    }));
  }

  const histAdv = hist.filter(f => !["UC", "STD"].includes(f.classification));
  if (histAdv.length && override !== "UNACCEPTABLE") {
    if (raw > 59) raw = 59;
    if (!override || override === "LOW" || override === "MODERATE") override = raw < 40 ? "HIGH" : "ELEVATED";
    histAdv.forEach(f => flags.push({
      ok: false,
      t: "Historical " + (CLS[f.classification]?.label || f.classification) + " (" + f.status + ")",
      d: f.institution + " (" + f.type + ") \u2014 capped at Elevated.",
    }));
  }

  // Positive/negative flags
  if (!liveAdv.length && !liveSMA.length && !histAdv.length) {
    flags.push({ ok: true, t: "Clean Classification", d: "No adverse classification on any facility." });
  }
  if (tOver === 0 && tOut > 0) {
    flags.push({ ok: true, t: "Zero Overdue", d: "No overdue on live funded facilities." });
  }
  if (tOver > 0) {
    flags.push({ ok: false, t: "Overdue Alert", d: "BDT " + fmt(tOver) + " overdue (" + ((tOver / tOut) * 100).toFixed(1) + "%)" });
  }
  if (tLim > 0) {
    const ur = tOut / tLim;
    if (ur <= 0.30) flags.push({ ok: true, t: "Low Utilization", d: (ur * 100).toFixed(0) + "% of limits drawn. Healthy headroom." });
    else if (ur > 0.80) flags.push({ ok: false, t: "High Utilization", d: (ur * 100).toFixed(0) + "% drawn. Limited headroom." });
  }

  return {
    total: raw, override,
    bd: {
      "Overdue History": { s: os, w: 50, pts: Math.round(os * 0.50) },
      "Utilization (lower=better)": { s: us, w: 40, pts: Math.round(us * 0.40) },
      "Facility Mix": { s: ms, w: 10, pts: Math.round(ms * 0.10) },
      "Classification Penalty": { s: -Math.round(ap * 100), w: -50, pts: -pp, isPenalty: true },
    },
    agg: { tLim, tOut, tOver, funded: funded.length, live: live.length, hist: hist.length, total: facs.length, util: tLim > 0 ? tOut / tLim : 0, baseScore },
    flags,
  };
}
