import { BANDS } from '../../constants/bands';

const FACTORS = [
  {
    name: "Overdue History",
    weight: "50%",
    desc: "Measures overdue exposure relative to total outstanding on live funded facilities.",
    table: [
      ["0%", "100", "No overdue — perfect repayment discipline"],
      ["≤ 2%", "85", "Negligible overdue"],
      ["≤ 5%", "65", "Minor overdue — watch list"],
      ["≤ 10%", "40", "Moderate overdue — concern"],
      ["≤ 20%", "20", "Significant overdue"],
      ["≤ 30%", "8", "Severe overdue"],
      ["> 30%", "0", "Critical delinquency"],
    ],
  },
  {
    name: "Utilization Ratio",
    weight: "40%",
    desc: "Measures how much of sanctioned limits are drawn. Lower utilization = better headroom and lower risk.",
    table: [
      ["≤ 10%", "100", "Minimal draw — maximum headroom"],
      ["≤ 30%", "90–95", "Conservative utilization"],
      ["≤ 50%", "78–85", "Moderate utilization"],
      ["≤ 70%", "55–68", "Elevated utilization"],
      ["≤ 90%", "22–40", "High utilization — limited buffer"],
      ["≤ 95%", "10", "Near-full draw"],
      ["> 95%", "0", "Fully drawn or over-limit"],
    ],
  },
  {
    name: "Facility Mix",
    weight: "10%",
    desc: "Rewards diverse credit types. A mix of funded and non-funded facilities signals mature credit usage.",
    table: [
      ["Funded + Non-Funded", "100", "Balanced facility mix"],
      ["Funded only", "55", "Funded only — acceptable"],
      ["Non-Funded only", "30", "Non-funded only — limited credit history"],
      ["No live facilities", "50", "Neutral — no active facilities"],
    ],
  },
];

const OVERRIDES = [
  {
    trigger: "Live adverse classification (SS / DF / BL / BLW)",
    effect: "Score capped at 15. Override → UNACCEPTABLE. Auto-decline.",
    color: "#991b1b",
    bg: "#fef2f2",
  },
  {
    trigger: "Live SMA (Special Mention Account)",
    effect: "Score capped at 59. Override → ELEVATED or HIGH. Enhanced due diligence.",
    color: "#d97706",
    bg: "#fffbeb",
  },
  {
    trigger: "Historical adverse classification (non-STD terminated)",
    effect: "Score capped at 59. Override → ELEVATED or HIGH. Past issues flag ongoing risk.",
    color: "#d97706",
    bg: "#fffbeb",
  },
];

const PENALTY_INFO = {
  desc: "Each facility's classification carries a penalty weight. The weighted average penalty (by outstanding/limit) is applied as a deduction of up to 50 points from the base score.",
  table: [
    ["UC / STD", "0%", "Standard — no penalty"],
    ["SMA", "20%", "Early warning — moderate penalty"],
    ["SS", "50%", "Substandard — significant penalty"],
    ["DF", "80%", "Doubtful — severe penalty"],
    ["BL / BLW", "100%", "Bad/Loss — maximum penalty"],
  ],
};

const RED_FLAGS_INFO = [
  { flag: "Live Defaulter (DF)", desc: "Any live facility classified as Doubtful", severity: "Critical" },
  { flag: "Live Bad/Loss (BL/BLW)", desc: "Any live facility classified as Bad Loan or Written-Off", severity: "Critical" },
  { flag: "Willful Default", desc: "Facility marked as willful default", severity: "Critical" },
  { flag: "Rescheduled", desc: "Facility has been rescheduled 1 or more times", severity: "Warning" },
  { flag: "Reorganized Credit", desc: "Facility flagged as reorganized", severity: "Warning" },
  { flag: "Lawsuit Filed", desc: "Legal suit filed on a facility", severity: "Warning" },
  { flag: "Live SMA", desc: "Any live facility classified as Special Mention Account", severity: "Warning" },
  { flag: "Adverse Status (SS/DF/BL)", desc: "Any facility (live or terminated) with adverse classification", severity: "Warning" },
];

const s = {
  page: { maxWidth: 900, margin: "0 auto", padding: "24px 20px 60px" },
  h1: { fontSize: 22, fontWeight: 800, color: "#0c4a6e", marginBottom: 4 },
  sub: { fontSize: 13, color: "#64748b", marginBottom: 28 },
  section: { marginBottom: 32 },
  h2: { fontSize: 16, fontWeight: 700, color: "#0f172a", marginBottom: 12, paddingBottom: 6, borderBottom: "2px solid #e2e8f0" },
  h3: { fontSize: 13, fontWeight: 700, color: "#334155", marginBottom: 6 },
  p: { fontSize: 12.5, color: "#475569", lineHeight: 1.7, marginBottom: 10 },
  card: { background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", padding: 16, marginBottom: 14, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" },
  th: { fontSize: 10.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5, padding: "6px 10px", textAlign: "left", borderBottom: "2px solid #e2e8f0", background: "#f8fafc" },
  td: { fontSize: 12, color: "#334155", padding: "6px 10px", borderBottom: "1px solid #f1f5f9" },
  badge: (color, bg) => ({ display: "inline-block", fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 4, color, background: bg }),
  formula: { background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, padding: "12px 16px", fontFamily: "monospace", fontSize: 12.5, color: "#0c4a6e", marginBottom: 14, lineHeight: 1.8 },
  back: { background: "none", border: "none", color: "#0ea5e9", cursor: "pointer", fontSize: 12, fontWeight: 600, padding: 0, marginBottom: 16, display: "flex", alignItems: "center", gap: 4 },
};

export default function ScoreExplainer({ onBack }) {
  return (
    <div style={s.page}>
      {onBack && <button onClick={onBack} style={s.back}>← Back to Reports</button>}
      <h1 style={s.h1}>Risk Grading & Score Methodology</h1>
      <p style={s.sub}>How CIBxRay calculates credit risk scores from Bangladesh Bank CIB reports</p>

      {/* Score Formula */}
      <div style={s.section}>
        <h2 style={s.h2}>Score Formula</h2>
        <div style={s.formula}>
          <strong>Base Score</strong> = (Overdue History × 0.50) + (Utilization × 0.40) + (Facility Mix × 0.10)<br />
          <strong>Final Score</strong> = Base Score − Classification Penalty (up to −50 pts)<br />
          <strong>Range:</strong> 0 – 100 &nbsp;|&nbsp; Higher = Lower Risk
        </div>
      </div>

      {/* Risk Bands */}
      <div style={s.section}>
        <h2 style={s.h2}>Risk Bands</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden", border: "1px solid #e2e8f0" }}>
          <thead>
            <tr>
              <th style={s.th}>Band</th>
              <th style={s.th}>Score Range</th>
              <th style={s.th}>Meaning</th>
            </tr>
          </thead>
          <tbody>
            {BANDS.map(b => (
              <tr key={b.key}>
                <td style={s.td}><span style={s.badge(b.color, b.bg)}>{b.label}</span></td>
                <td style={{ ...s.td, fontWeight: 600, fontFamily: "monospace" }}>{b.min === -1 ? 0 : b.min} – {b.max}</td>
                <td style={s.td}>{b.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Scoring Factors */}
      <div style={s.section}>
        <h2 style={s.h2}>Scoring Factors</h2>
        {FACTORS.map(f => (
          <div key={f.name} style={s.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h3 style={{ ...s.h3, margin: 0 }}>{f.name}</h3>
              <span style={s.badge("#0c4a6e", "#e0f2fe")}>Weight: {f.weight}</span>
            </div>
            <p style={{ ...s.p, marginBottom: 8 }}>{f.desc}</p>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ ...s.th, width: "25%" }}>Ratio / Condition</th>
                  <th style={{ ...s.th, width: "20%" }}>Score</th>
                  <th style={s.th}>Interpretation</th>
                </tr>
              </thead>
              <tbody>
                {f.table.map((row, i) => (
                  <tr key={i}>
                    <td style={{ ...s.td, fontWeight: 600, fontFamily: "monospace" }}>{row[0]}</td>
                    <td style={{ ...s.td, fontFamily: "monospace" }}>{row[1]}</td>
                    <td style={s.td}>{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {/* Classification Penalty */}
      <div style={s.section}>
        <h2 style={s.h2}>Classification Penalty (up to −50 pts)</h2>
        <p style={s.p}>{PENALTY_INFO.desc}</p>
        <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden", border: "1px solid #e2e8f0" }}>
          <thead>
            <tr>
              <th style={s.th}>Classification</th>
              <th style={s.th}>Penalty Weight</th>
              <th style={s.th}>Description</th>
            </tr>
          </thead>
          <tbody>
            {PENALTY_INFO.table.map((row, i) => (
              <tr key={i}>
                <td style={{ ...s.td, fontWeight: 700 }}>{row[0]}</td>
                <td style={{ ...s.td, fontFamily: "monospace", fontWeight: 600, color: i >= 2 ? "#dc2626" : "#334155" }}>{row[1]}</td>
                <td style={s.td}>{row[2]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Hard Overrides */}
      <div style={s.section}>
        <h2 style={s.h2}>Hard Overrides</h2>
        <p style={s.p}>Certain conditions force the score band regardless of the calculated number:</p>
        {OVERRIDES.map((o, i) => (
          <div key={i} style={{ ...s.card, borderLeft: `4px solid ${o.color}`, background: o.bg }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: o.color, marginBottom: 4 }}>{o.trigger}</div>
            <div style={{ fontSize: 12, color: "#475569" }}>{o.effect}</div>
          </div>
        ))}
      </div>

      {/* Red Flags */}
      <div style={s.section}>
        <h2 style={s.h2}>Red Flag Definitions</h2>
        <p style={s.p}>Red flags are independent of the score — they highlight specific risk signals that require attention regardless of overall rating.</p>
        <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden", border: "1px solid #e2e8f0" }}>
          <thead>
            <tr>
              <th style={s.th}>Flag</th>
              <th style={s.th}>Trigger Condition</th>
              <th style={s.th}>Severity</th>
            </tr>
          </thead>
          <tbody>
            {RED_FLAGS_INFO.map((r, i) => (
              <tr key={i}>
                <td style={{ ...s.td, fontWeight: 600 }}>{r.flag}</td>
                <td style={s.td}>{r.desc}</td>
                <td style={s.td}>
                  <span style={s.badge(
                    r.severity === "Critical" ? "#991b1b" : "#d97706",
                    r.severity === "Critical" ? "#fef2f2" : "#fffbeb"
                  )}>{r.severity}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Clean CIB */}
      <div style={s.section}>
        <h2 style={s.h2}>Clean CIB (No Credit Facilities)</h2>
        <div style={s.card}>
          <p style={s.p}>When a CIB report contains zero borrower facilities, the applicant has no credit history. This is treated as <strong>Moderate Risk</strong> — the absence of credit history is neither positive nor negative, but it means:</p>
          <ul style={{ fontSize: 12.5, color: "#475569", lineHeight: 2, paddingLeft: 20, margin: "8px 0" }}>
            <li>No repayment track record to assess</li>
            <li>Cannot evaluate credit discipline or utilization</li>
            <li>Score is not calculated (shown as "—" with MODERATE label)</li>
            <li>If borrower facilities exist but guarantor-only, labelled "Clean CIB — No Credit History as Borrower"</li>
          </ul>
        </div>
      </div>

      {/* Data Source */}
      <div style={s.section}>
        <h2 style={s.h2}>Data Source & Methodology</h2>
        <div style={s.card}>
          <p style={{ ...s.p, marginBottom: 6 }}><strong>Source:</strong> Bangladesh Bank Credit Information Bureau (CIB) reports in standard PDF format.</p>
          <p style={{ ...s.p, marginBottom: 6 }}><strong>Parsing:</strong> Client-side PDF.js extraction with deterministic regex patterns — no AI, no data leaves the browser.</p>
          <p style={{ ...s.p, marginBottom: 6 }}><strong>Scope:</strong> Analysis covers borrower facilities only. Guarantor exposures are displayed but not scored.</p>
          <p style={{ ...s.p, marginBottom: 0 }}><strong>Limitations:</strong> Accuracy depends on CIB report format consistency. Non-standard layouts may not parse correctly.</p>
        </div>
      </div>

      <div style={{ textAlign: "center", fontSize: 11, color: "#94a3b8", marginTop: 40 }}>
        CIBxRay Risk Methodology v1.0 — For internal credit assessment only
      </div>
    </div>
  );
}
