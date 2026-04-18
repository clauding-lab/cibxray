import { fmt } from '../../utils/format.js';
import { S } from '../../constants/theme.js';
import Gauge from '../shared/Gauge.jsx';

export default function ScoreBlock({ score, band, dataTierNote, variant = 'screen' }) {
  const b = band;

  return (
    <div data-testid="score-block" className={`score-block-${variant}`}>
      <div style={{ ...S.card, display: "flex", alignItems: "center", gap: 18, background: b.bg, border: "1px solid " + b.color + "22" }}>
        <Gauge score={score.total} override={score.override} />
        <div style={{ flex: 1 }}>
          {score.override === "UNACCEPTABLE" && <span style={{ fontSize: 10, background: "#991b1b", color: "#fff", padding: "2px 8px", borderRadius: 4, fontWeight: 700, display: "inline-block", marginBottom: 4 }}>AUTO-DECLINE</span>}
          <p style={{ fontSize: 12.5, color: "#334155", lineHeight: 1.5 }}>{b.desc}</p>
          {score.override && <p style={{ fontSize: 11, color: b.color, fontWeight: 600, marginTop: 4 }}>Override: {score.override}</p>}
        </div>
      </div>

      {dataTierNote && (
        <div style={{ margin: '8px 0', padding: '10px 12px', background: '#eff6ff', border: '1px solid #93c5fd', borderRadius: 8, color: '#1e40af', fontSize: 12 }}>
          {dataTierNote}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8, marginBottom: 12 }}>
        {[["Live Facs", score.agg.live], ["Total Limit", "\u09F3" + fmt(score.agg.tLim)], ["Outstanding", "\u09F3" + fmt(score.agg.tOut)], ["Overdue", "\u09F3" + fmt(score.agg.tOver)], ["Utilization", (score.agg.util * 100).toFixed(0) + "%"]].map(([l, v], idx) => (
          <div key={l} style={{ background: "#fff", borderRadius: 8, padding: "10px 12px", border: "1px solid #e2e8f0" }}>
            <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 2 }}>{l}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: (idx === 3 && score.agg.tOver > 0) || (idx === 4 && score.agg.util > 0.8) ? "#dc2626" : "#0f172a" }}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
