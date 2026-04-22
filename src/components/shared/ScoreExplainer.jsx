import { BANDS } from '../../constants/bands';

const FACTORS = [
  {
    name: "Overdue History",
    weight: "60%",
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
    weight: "30%",
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
    color: "#fca5a5",
  },
  {
    trigger: "Live SMA (Special Mention Account)",
    effect: "Score capped at 59. Override → ELEVATED or HIGH. Enhanced due diligence.",
    color: "#fcd34d",
  },
  {
    trigger: "Historical adverse classification (non-STD terminated)",
    effect: "Score capped at 59. Override → ELEVATED or HIGH. Past issues flag ongoing risk.",
    color: "#fcd34d",
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
  { flag: "Expired CIB Report", desc: "Inquiry date is more than 60 days old from upload date", severity: "Warning" },
  { flag: "Unverified Name/NID", desc: "Name, NID, or DOB marked 'Not Verified' by Bangladesh Bank", severity: "Warning" },
];

const S = {
  headline: {
    fontStyle: "italic",
    fontSize: 14,
    color: "#7dd3fc",
    borderLeft: "3px solid #0ea5e9",
    padding: "10px 14px",
    background: "rgba(14,165,233,0.08)",
    borderRadius: "0 6px 6px 0",
    marginBottom: 22,
  },
  h3: {
    fontSize: 13,
    fontWeight: 700,
    color: "#e0f2fe",
    letterSpacing: 1,
    textTransform: "uppercase",
    margin: "22px 0 10px 0",
  },
  p: { fontSize: 12.5, color: "#cbd5e1", lineHeight: 1.6, marginBottom: 10 },
  formula: {
    background: "rgba(2,6,23,0.4)",
    border: "1px solid rgba(56,189,248,0.25)",
    borderRadius: 8,
    padding: "14px 16px",
    fontFamily: "'SF Mono', Menlo, Consolas, monospace",
    fontSize: 12.5,
    color: "#e0f2fe",
    lineHeight: 1.9,
  },
  factorCard: {
    background: "rgba(2,6,23,0.4)",
    border: "1px solid rgba(56,189,248,0.2)",
    borderRadius: 8,
    padding: "14px 16px",
    marginBottom: 12,
  },
  factorHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  factorName: {
    fontSize: 13.5,
    fontWeight: 700,
    color: "#e0f2fe",
  },
  weightBadge: {
    display: "inline-block",
    fontSize: 10.5,
    fontWeight: 700,
    padding: "3px 9px",
    borderRadius: 4,
    color: "#7dd3fc",
    background: "rgba(14,165,233,0.15)",
    border: "1px solid rgba(56,189,248,0.3)",
    letterSpacing: 0.5,
  },
  factorDesc: { fontSize: 12, color: "#94a3b8", marginBottom: 10, lineHeight: 1.55 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 12.5 },
  th: {
    textAlign: "left",
    padding: "8px 10px",
    color: "#7dd3fc",
    fontWeight: 600,
    borderBottom: "1px solid rgba(56,189,248,0.25)",
    background: "rgba(14,165,233,0.06)",
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  td: {
    padding: "8px 10px",
    borderBottom: "1px solid rgba(56,189,248,0.1)",
    verticalAlign: "top",
    color: "#cbd5e1",
  },
  tdMono: {
    padding: "8px 10px",
    borderBottom: "1px solid rgba(56,189,248,0.1)",
    color: "#e0f2fe",
    fontFamily: "'SF Mono', Menlo, Consolas, monospace",
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  bandBadge: (color, bg) => ({
    display: "inline-block",
    fontSize: 10.5,
    fontWeight: 700,
    padding: "3px 9px",
    borderRadius: 4,
    color,
    background: bg,
    border: `1px solid ${color}33`,
  }),
  sevBadge: (color) => ({
    display: "inline-block",
    fontSize: 10.5,
    fontWeight: 700,
    padding: "3px 9px",
    borderRadius: 4,
    color,
    background: `${color}1a`,
    border: `1px solid ${color}44`,
  }),
  overrideCard: (color) => ({
    background: `${color}0f`,
    borderLeft: `3px solid ${color}`,
    border: `1px solid ${color}33`,
    borderLeftWidth: 3,
    borderRadius: 6,
    padding: "10px 14px",
    marginBottom: 10,
  }),
  overrideTrigger: (color) => ({
    fontSize: 12.5,
    fontWeight: 700,
    color,
    marginBottom: 3,
  }),
  overrideEffect: { fontSize: 12, color: "#cbd5e1", lineHeight: 1.5 },
  infoCard: {
    background: "rgba(2,6,23,0.4)",
    border: "1px solid rgba(56,189,248,0.2)",
    borderRadius: 8,
    padding: "14px 16px",
  },
  ul: {
    fontSize: 12.5,
    color: "#cbd5e1",
    lineHeight: 1.8,
    paddingLeft: 20,
    margin: "8px 0 0 0",
  },
  footer: {
    textAlign: "center",
    fontSize: 11,
    color: "#64748b",
    marginTop: 28,
    paddingTop: 14,
    borderTop: "1px solid rgba(56,189,248,0.15)",
  },
};

export default function ScoreExplainer() {
  return (
    <>
      <div style={S.headline}>
        How CIBxRay calculates credit risk scores from Bangladesh Bank CIB reports — a deterministic, auditable 0–100 scale.
      </div>

      <div style={S.h3}>Score formula</div>
      <div style={S.formula}>
        <strong style={{ color: "#7dd3fc" }}>Base Score</strong> = (Overdue History × 0.60) + (Utilization × 0.30) + (Facility Mix × 0.10)<br />
        <strong style={{ color: "#7dd3fc" }}>Final Score</strong> = Base Score − Classification Penalty (up to −50 pts)<br />
        <strong style={{ color: "#7dd3fc" }}>Range:</strong> 0 – 100 &nbsp;|&nbsp; Higher = Lower Risk
      </div>

      <div style={S.h3}>Risk bands</div>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>Band</th>
            <th style={S.th}>Score Range</th>
            <th style={S.th}>Meaning</th>
          </tr>
        </thead>
        <tbody>
          {BANDS.map(b => (
            <tr key={b.key}>
              <td style={S.td}><span style={S.bandBadge(b.color, b.bg)}>{b.label}</span></td>
              <td style={S.tdMono}>{b.min === -1 ? 0 : b.min} – {b.max}</td>
              <td style={S.td}>{b.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={S.h3}>Scoring factors</div>
      {FACTORS.map(f => (
        <div key={f.name} style={S.factorCard}>
          <div style={S.factorHead}>
            <div style={S.factorName}>{f.name}</div>
            <span style={S.weightBadge}>Weight: {f.weight}</span>
          </div>
          <div style={S.factorDesc}>{f.desc}</div>
          <table style={S.table}>
            <thead>
              <tr>
                <th style={{ ...S.th, width: "25%" }}>Ratio / Condition</th>
                <th style={{ ...S.th, width: "20%" }}>Score</th>
                <th style={S.th}>Interpretation</th>
              </tr>
            </thead>
            <tbody>
              {f.table.map((row, i) => (
                <tr key={i}>
                  <td style={S.tdMono}>{row[0]}</td>
                  <td style={S.tdMono}>{row[1]}</td>
                  <td style={S.td}>{row[2]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <div style={S.h3}>Classification penalty (up to −50 pts)</div>
      <p style={S.p}>{PENALTY_INFO.desc}</p>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>Classification</th>
            <th style={S.th}>Penalty Weight</th>
            <th style={S.th}>Description</th>
          </tr>
        </thead>
        <tbody>
          {PENALTY_INFO.table.map((row, i) => (
            <tr key={i}>
              <td style={{ ...S.tdMono, color: "#e0f2fe" }}>{row[0]}</td>
              <td style={{ ...S.tdMono, color: i >= 2 ? "#fca5a5" : "#7dd3fc" }}>{row[1]}</td>
              <td style={S.td}>{row[2]}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={S.h3}>Hard overrides</div>
      <p style={S.p}>Certain conditions force the score band regardless of the calculated number:</p>
      {OVERRIDES.map((o, i) => (
        <div key={i} style={S.overrideCard(o.color)}>
          <div style={S.overrideTrigger(o.color)}>{o.trigger}</div>
          <div style={S.overrideEffect}>{o.effect}</div>
        </div>
      ))}

      <div style={S.h3}>Red flag definitions</div>
      <p style={S.p}>Red flags are independent of the score — they highlight specific risk signals that require attention regardless of overall rating.</p>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>Flag</th>
            <th style={S.th}>Trigger Condition</th>
            <th style={S.th}>Severity</th>
          </tr>
        </thead>
        <tbody>
          {RED_FLAGS_INFO.map((r, i) => (
            <tr key={i}>
              <td style={{ ...S.td, color: "#e0f2fe", fontWeight: 600, whiteSpace: "nowrap" }}>{r.flag}</td>
              <td style={S.td}>{r.desc}</td>
              <td style={S.td}>
                <span style={S.sevBadge(r.severity === "Critical" ? "#fca5a5" : "#fcd34d")}>{r.severity}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={S.h3}>Clean CIB (no credit facilities)</div>
      <div style={S.infoCard}>
        <p style={{ ...S.p, marginBottom: 4 }}>When a CIB report contains zero borrower facilities, the applicant has no credit history. This is treated as <strong style={{ color: "#e0f2fe" }}>Moderate Risk</strong> — the absence of credit history is neither positive nor negative, but it means:</p>
        <ul style={S.ul}>
          <li>No repayment track record to assess</li>
          <li>Cannot evaluate credit discipline or utilization</li>
          <li>Score is not calculated (shown as "—" with MODERATE label)</li>
          <li>If borrower facilities exist but guarantor-only, labelled "Clean CIB — No Credit History as Borrower"</li>
        </ul>
      </div>

      <div style={S.h3}>Data source &amp; methodology</div>
      <div style={S.infoCard}>
        <p style={{ ...S.p, marginBottom: 6 }}><strong style={{ color: "#e0f2fe" }}>Source:</strong> Bangladesh Bank Credit Information Bureau (CIB) reports in standard PDF format.</p>
        <p style={{ ...S.p, marginBottom: 6 }}><strong style={{ color: "#e0f2fe" }}>Parsing:</strong> Client-side PDF.js extraction with deterministic regex patterns — no AI, no data leaves the browser.</p>
        <p style={{ ...S.p, marginBottom: 6 }}><strong style={{ color: "#e0f2fe" }}>Scope:</strong> Analysis covers borrower facilities only. Guarantor exposures are displayed but not scored.</p>
        <p style={{ ...S.p, marginBottom: 0 }}><strong style={{ color: "#e0f2fe" }}>Limitations:</strong> Accuracy depends on CIB report format consistency. Non-standard layouts may not parse correctly.</p>
      </div>

      <div style={S.footer}>CIBxRay Risk Methodology v1.0 — For internal credit assessment only</div>
    </>
  );
}
