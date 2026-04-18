import { S } from '../../constants/theme';
import { getBand } from '../../constants/bands';

export default function BreakdownBars({ score, variant = 'screen' }) {
  const b = getBand(score.total, score.override);

  return (
    <div data-testid="breakdown-bars" className={`breakdown-bars-${variant}`}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={S.card}>
          <div style={S.sec}>Score Breakdown (3-Factor + Penalty)</div>
          {Object.entries(score.bd).map(([k, v]) => {
            const isPen = v.isPenalty;
            const c = isPen ? (v.pts === 0 ? "#059669" : "#dc2626") : v.s >= 70 ? "#059669" : v.s >= 40 ? "#d97706" : "#dc2626";
            return (
              <div key={k} style={{ marginBottom: 11 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 2 }}>
                  <span style={{ fontWeight: 500 }}>{k}</span>
                  <span style={{ fontWeight: 600, color: c }}>{isPen ? v.pts + "pts" : v.s + "/100 = " + v.pts + "pts"} <span style={{ color: "#94a3b8", fontWeight: 400 }}>({v.w}%)</span></span>
                </div>
                <div style={{ background: "#f1f5f9", borderRadius: 3, height: 6, overflow: "hidden" }}>
                  <div style={{ width: (isPen ? Math.min(Math.abs(v.pts), 50) / 50 * 100 : v.s) + "%", height: "100%", background: c, borderRadius: 3 }} />
                </div>
              </div>
            );
          })}
          <div style={{ borderTop: "2px solid #e2e8f0", paddingTop: 8, display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700 }}>
            <span>FINAL</span><span style={{ color: b.color }}>{score.total}/100</span>
          </div>
        </div>
        <div style={S.card}>
          <div style={S.sec}>Flags</div>
          {score.flags.map((f, i) => (
            <div key={i} style={{ background: f.critical ? "#fecaca" : f.ok ? "#ecfdf5" : "#fffbeb", borderRadius: 6, padding: "8px 12px", marginBottom: 6, border: "1px solid " + (f.critical ? "#991b1b" : f.ok ? "#059669" : "#d97706") + "20" }}>
              <div style={{ fontWeight: 600, fontSize: 11.5, color: f.critical ? "#991b1b" : f.ok ? "#059669" : "#d97706", marginBottom: 1 }}>{f.critical ? "\u26D4 " : f.ok ? "\u2713 " : "\u26A0 "}{f.t}</div>
              <div style={{ fontSize: 11, color: "#334155" }}>{f.d}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
