import { useState } from 'react';
import { CLS } from '../../constants/classifications';
import { fmt } from '../../utils/format';
import { S } from '../../constants/theme';

const clsOrder = ["BLW", "BL", "DF", "SS", "SMA", "STD", "UC"];
const statusDotColor = (cls) => (CLS[cls] || CLS.STD).color;

export default function RepaymentChart({ facs, title }) {
  const [hover, setHover] = useState(null);
  const [selectedFac, setSelectedFac] = useState("all");

  const facsWithHistory = facs.filter(f => f.history && f.history.length > 1);
  if (facsWithHistory.length === 0) return null;

  const facOptions = [
    { key: "all", label: "All (Aggregated)", group: "View" },
    { key: "f:live", label: "Live Only", group: "Filter" },
    { key: "f:terminated", label: "Terminated Only", group: "Filter" },
    { key: "f:funded", label: "Funded Only", group: "Filter" },
    { key: "f:nonfunded", label: "Non-Funded Only", group: "Filter" },
    { key: "f:funded-live", label: "Funded + Live", group: "Filter" },
    { key: "f:funded-term", label: "Funded + Terminated", group: "Filter" },
    { key: "f:nonfunded-live", label: "Non-Funded + Live", group: "Filter" },
    { key: "f:nonfunded-term", label: "Non-Funded + Terminated", group: "Filter" },
  ];
  facsWithHistory.forEach((f, i) => {
    facOptions.push({
      key: String(i),
      label: (f.type || "Facility") + " (" + f.contractCode.slice(0, 10) + ")" + (f.status === "Live" ? " \u25CF" : ""),
      group: "Individual",
    });
  });

  const getFilteredFacs = () => {
    if (selectedFac === "all") return facsWithHistory;
    if (selectedFac === "f:live") return facsWithHistory.filter(f => f.status === "Live");
    if (selectedFac === "f:terminated") return facsWithHistory.filter(f => f.status !== "Live");
    if (selectedFac === "f:funded") return facsWithHistory.filter(f => f.nature === "Funded");
    if (selectedFac === "f:nonfunded") return facsWithHistory.filter(f => f.nature === "Non-Funded");
    if (selectedFac === "f:funded-live") return facsWithHistory.filter(f => f.nature === "Funded" && f.status === "Live");
    if (selectedFac === "f:funded-term") return facsWithHistory.filter(f => f.nature === "Funded" && f.status !== "Live");
    if (selectedFac === "f:nonfunded-live") return facsWithHistory.filter(f => f.nature === "Non-Funded" && f.status === "Live");
    if (selectedFac === "f:nonfunded-term") return facsWithHistory.filter(f => f.nature === "Non-Funded" && f.status !== "Live");
    return null;
  };

  let chartData = [];
  const filtered = getFilteredFacs();
  if (filtered) {
    const monthMap = {};
    filtered.forEach(f => {
      f.history.forEach(h => {
        const key = h.date;
        if (!monthMap[key]) monthMap[key] = { date: key, dateStr: h.dateStr, outstanding: 0, overdue: 0, limit: 0, worstCls: "UC" };
        monthMap[key].outstanding += h.outstanding;
        monthMap[key].overdue += h.overdue;
        monthMap[key].limit += h.limit;
        const fi = clsOrder.indexOf(h.status);
        const wi = clsOrder.indexOf(monthMap[key].worstCls);
        if (fi >= 0 && fi < wi) monthMap[key].worstCls = h.status;
      });
    });
    chartData = Object.values(monthMap).sort((a, b) => a.date.localeCompare(b.date));
  } else {
    const f = facsWithHistory[parseInt(selectedFac)];
    if (f) chartData = f.history.map(h => ({ ...h, worstCls: h.status }));
  }

  if (chartData.length < 2) return null;

  const W = 780, H = 280, padL = 70, padR = 20, padT = 20, padB = 50;
  const cW = W - padL - padR, cH = H - padT - padB;
  const maxOut = Math.max(...chartData.map(d => d.outstanding), 1);
  const maxOver = Math.max(...chartData.map(d => d.overdue), 0);
  const maxY = Math.max(maxOut, maxOver) * 1.1 || 1;

  const x = (i) => padL + (i / (chartData.length - 1)) * cW;
  const y = (v) => padT + cH - (v / maxY) * cH;

  const outPath = chartData.map((d, i) => (i === 0 ? "M" : "L") + x(i).toFixed(1) + "," + y(d.outstanding).toFixed(1)).join(" ");
  const overPath = chartData.map((d, i) => (i === 0 ? "M" : "L") + x(i).toFixed(1) + "," + y(d.overdue).toFixed(1)).join(" ");
  const outArea = outPath + " L" + x(chartData.length - 1).toFixed(1) + "," + (padT + cH) + " L" + padL + "," + (padT + cH) + " Z";

  const yTicks = [];
  for (let i = 0; i <= 5; i++) {
    const val = (maxY / 5) * i;
    yTicks.push({ val, y: y(val) });
  }
  const labelEvery = Math.max(1, Math.floor(chartData.length / 8));
  const hd = hover !== null ? chartData[hover] : null;

  return (
    <div style={S.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={S.sec}>{title || "Repayment Timeline"}</div>
        <select value={selectedFac} onChange={e => { setSelectedFac(e.target.value); setHover(null); }}
          style={{ fontSize: 11, padding: "4px 8px", border: "1px solid #e2e8f0", borderRadius: 5, color: "#0f172a", outline: "none", maxWidth: 320 }}>
          {["View", "Filter", "Individual"].map(group => {
            const opts = facOptions.filter(o => o.group === group);
            if (!opts.length) return null;
            return (
              <optgroup key={group} label={group === "View" ? "Aggregated" : group === "Filter" ? "Filtered" : "Individual Facility"}>
                {opts.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
              </optgroup>
            );
          })}
        </select>
      </div>

      <div style={{ display: "flex", gap: 16, marginBottom: 8, fontSize: 11 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 12, height: 3, background: "#3b82f6", borderRadius: 2, display: "inline-block" }} /> Outstanding</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 12, height: 3, background: "#dc2626", borderRadius: 2, display: "inline-block" }} /> Overdue</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 4, background: "#d97706", display: "inline-block" }} /> Classification status (dot color)</span>
      </div>

      <div style={{ position: "relative", width: "100%", overflowX: "auto" }}>
        <svg width="100%" height={H} viewBox={"0 0 " + W + " " + H} preserveAspectRatio="xMinYMid meet" style={{ display: "block", overflow: "visible", minWidth: 400 }}
          onMouseLeave={() => setHover(null)}>
          {yTicks.map((t, i) => (
            <g key={i}>
              <line x1={padL} x2={W - padR} y1={t.y} y2={t.y} stroke="#f1f5f9" strokeWidth="1" />
              <text x={padL - 8} y={t.y + 3} textAnchor="end" fontSize="10" fill="#94a3b8">{fmt(t.val)}</text>
            </g>
          ))}
          <line x1={padL} x2={padL} y1={padT} y2={padT + cH} stroke="#e2e8f0" strokeWidth="1" />
          <line x1={padL} x2={W - padR} y1={padT + cH} y2={padT + cH} stroke="#e2e8f0" strokeWidth="1" />
          <path d={outArea} fill="#3b82f620" />
          <path d={outPath} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round" />
          {maxOver > 0 && <path d={overPath} fill="none" stroke="#dc2626" strokeWidth="2" strokeLinejoin="round" strokeDasharray="4,3" />}
          {chartData.map((d, i) => (
            <circle key={i} cx={x(i)} cy={y(d.outstanding)} r={hover === i ? 5 : 3}
              fill={statusDotColor(d.worstCls)} stroke="#fff" strokeWidth="1.5"
              style={{ cursor: "pointer", transition: "r 0.1s" }} />
          ))}
          {chartData.map((d, i) => i % labelEvery === 0 ? (
            <text key={i} x={x(i)} y={padT + cH + 16} textAnchor="middle" fontSize="9" fill="#94a3b8"
              transform={"rotate(-35," + x(i) + "," + (padT + cH + 16) + ")"}>{d.dateStr || d.date.slice(0, 7)}</text>
          ) : null)}
          {chartData.map((d, i) => (
            <rect key={"h" + i} x={x(i) - cW / chartData.length / 2} y={padT} width={cW / chartData.length}
              height={cH} fill="transparent" style={{ cursor: "crosshair" }}
              onMouseEnter={() => setHover(i)} />
          ))}
          {hover !== null && (
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={padT + cH} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3,3" />
          )}
        </svg>

        {hd && hover !== null && (
          <div style={{
            position: "absolute",
            left: ((Math.min(x(hover) + 12, W - 200)) / W * 100) + "%",
            top: ((Math.max(y(hd.outstanding) - 80, 0)) / H * 100) + "%",
            background: "#0f172a", color: "#fff", borderRadius: 8, padding: "10px 14px",
            fontSize: 11, lineHeight: 1.7, pointerEvents: "none", zIndex: 10,
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)", minWidth: 170,
          }}>
            <div style={{ fontWeight: 600, marginBottom: 3 }}>{hd.dateStr || hd.date}</div>
            <div>Outstanding: <span style={{ color: "#60a5fa", fontWeight: 600 }}>{"\u09F3"}{fmt(hd.outstanding)}</span></div>
            <div>Overdue: <span style={{ color: "#f87171", fontWeight: 600 }}>{"\u09F3"}{fmt(hd.overdue)}</span></div>
            {hd.limit > 0 && <div>Limit: <span style={{ color: "#94a3b8" }}>{"\u09F3"}{fmt(hd.limit)}</span></div>}
            <div>Status: <span style={{ color: statusDotColor(hd.worstCls), fontWeight: 600 }}>{hd.worstCls}</span></div>
          </div>
        )}
      </div>
    </div>
  );
}
