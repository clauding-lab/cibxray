import { CLS } from '../../constants/classifications';
import { fmt } from '../../utils/format';

const clsOrder = ["BLW", "BL", "DF", "SS", "SMA", "STD", "UC"];
const worstOf = (arr) => arr.reduce((w, f) => {
  const fi = clsOrder.indexOf(f.classification);
  const wi = clsOrder.indexOf(w);
  return fi >= 0 && fi < wi ? f.classification : w;
}, "UC");

export default function FacSummaryBar({ facs }) {
  const live = facs.filter(f => f.status === "Live");
  const term = facs.filter(f => f.status !== "Live");

  const rowData = (arr, label) => {
    const tLim = arr.reduce((s, f) => s + (f.limit || 0), 0);
    const tOut = arr.reduce((s, f) => s + (f.outstanding || 0), 0);
    const tOver = arr.reduce((s, f) => s + (f.overdue || 0), 0);
    const worst = arr.length ? worstOf(arr) : "\u2014";
    const wc = CLS[worst] || CLS.UC;
    return { label, count: arr.length, tLim, tOut, tOver, util: tLim > 0 ? tOut / tLim : 0, worst, wc };
  };

  const rows = [rowData(live, "Live"), rowData(term, "Terminated")];
  const totRow = rowData(facs, "Total");

  const hd = { fontSize: 10, fontWeight: 600, color: "#64748b", padding: "6px 8px", textAlign: "left", borderBottom: "2px solid #e2e8f0" };
  const td = { fontSize: 12, fontWeight: 600, padding: "8px 8px", borderBottom: "1px solid #f1f5f9" };

  return (
    <div style={{ background: "#fff", borderRadius: 8, marginBottom: 14, border: "1px solid #e2e8f0", overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>{["Status", "Count", "Limit", "Outstanding", "Overdue", "Utilization", "Worst Class."].map(h => <th key={h} style={hd}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.label}>
              <td style={{ ...td, color: r.label === "Live" ? "#059669" : "#94a3b8" }}>{r.label}</td>
              <td style={td}>{r.count}</td>
              <td style={{ ...td, fontFamily: "monospace" }}>{"\u09F3"}{fmt(r.tLim)}</td>
              <td style={{ ...td, fontFamily: "monospace" }}>{"\u09F3"}{fmt(r.tOut)}</td>
              <td style={{ ...td, fontFamily: "monospace", color: r.tOver > 0 ? "#dc2626" : "#059669" }}>{"\u09F3"}{fmt(r.tOver)}</td>
              <td style={{ ...td, color: r.util > 0.8 ? "#dc2626" : "#0f172a" }}>{r.count ? (r.util * 100).toFixed(0) + "%" : "\u2014"}</td>
              <td style={td}>{r.count ? <span style={{ background: r.wc.bg, color: r.wc.color, padding: "2px 7px", borderRadius: 4, fontSize: 10.5, fontWeight: 600 }}>{r.worst}</span> : "\u2014"}</td>
            </tr>
          ))}
          <tr style={{ background: "#f8fafc" }}>
            <td style={{ ...td, fontWeight: 700, borderBottom: "none" }}>Total</td>
            <td style={{ ...td, fontWeight: 700, borderBottom: "none" }}>{totRow.count}</td>
            <td style={{ ...td, fontWeight: 700, fontFamily: "monospace", borderBottom: "none" }}>{"\u09F3"}{fmt(totRow.tLim)}</td>
            <td style={{ ...td, fontWeight: 700, fontFamily: "monospace", borderBottom: "none" }}>{"\u09F3"}{fmt(totRow.tOut)}</td>
            <td style={{ ...td, fontWeight: 700, fontFamily: "monospace", borderBottom: "none", color: totRow.tOver > 0 ? "#dc2626" : "#059669" }}>{"\u09F3"}{fmt(totRow.tOver)}</td>
            <td style={{ ...td, fontWeight: 700, borderBottom: "none", color: totRow.util > 0.8 ? "#dc2626" : "#0f172a" }}>{totRow.count ? (totRow.util * 100).toFixed(0) + "%" : "\u2014"}</td>
            <td style={{ ...td, fontWeight: 700, borderBottom: "none" }}><span style={{ background: totRow.wc.bg, color: totRow.wc.color, padding: "2px 7px", borderRadius: 4, fontSize: 10.5, fontWeight: 600 }}>{totRow.worst}</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
