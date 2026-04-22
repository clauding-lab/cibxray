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
  ul: { margin: 0, paddingLeft: 20, color: "#cbd5e1" },
  li: { marginBottom: 4 },
  bannerNote: {
    marginTop: 14,
    padding: "10px 14px",
    background: "rgba(14,165,233,0.08)",
    border: "1px solid rgba(56,189,248,0.2)",
    borderRadius: 6,
    fontSize: 12.5,
    color: "#bae6fd",
  },
  table: { width: "100%", borderCollapse: "collapse", marginTop: 4, fontSize: 12.5 },
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
  tdNum: {
    padding: "8px 10px",
    borderBottom: "1px solid rgba(56,189,248,0.1)",
    color: "#7dd3fc",
    fontWeight: 700,
    width: 32,
  },
  tdTab: {
    padding: "8px 10px",
    borderBottom: "1px solid rgba(56,189,248,0.1)",
    color: "#e0f2fe",
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  diagramWrap: {
    display: "grid",
    gridTemplateColumns: "repeat(5, 1fr)",
    gap: 6,
    marginTop: 10,
    marginBottom: 12,
  },
  step: {
    background: "linear-gradient(180deg, rgba(14,165,233,0.18) 0%, rgba(14,165,233,0.05) 100%)",
    border: "1px solid rgba(56,189,248,0.3)",
    borderRadius: 8,
    padding: "12px 10px",
    position: "relative",
  },
  stepNum: {
    fontSize: 10,
    fontWeight: 700,
    color: "#38bdf8",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: "#e0f2fe",
    marginBottom: 6,
  },
  stepBody: {
    fontSize: 11.5,
    color: "#94a3b8",
    lineHeight: 1.5,
  },
  localBadge: {
    display: "flex",
    justifyContent: "space-around",
    gap: 6,
    marginBottom: 18,
    fontSize: 10.5,
    color: "#7dd3fc",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    fontWeight: 600,
  },
  localCell: {
    flex: 1,
    textAlign: "center",
    padding: "4px 0",
    borderTop: "1px dashed rgba(56,189,248,0.3)",
  },
};

const STEPS = [
  { n: "Step 1", title: "Upload", body: "Drag a CIB PDF, or pick one. Up to 50 MB." },
  { n: "Step 2", title: "Read PDF", body: "Extract text layer using pdfjs-dist (Mozilla). 100% local." },
  { n: "Step 3", title: "Parse", body: "Structure as borrower + facilities + history + guarantors." },
  { n: "Step 4", title: "Analyse", body: "Run 30+ rules across exposure, behaviour, cards." },
  { n: "Step 5", title: "Display", body: "Render 9 tabs (see below)." },
];

const TABS = [
  ["1", "Summary", "Top-line score, counts, parse quality, red-flag summary"],
  ["2", "Borrower", "Borrower/Co-Borrower facility list, status, outstanding, overdue"],
  ["3", "Guarantor", "Guarantor-only facilities, broken out separately"],
  ["4", "Exposure Analytics", "Live-loan EMI total, reschedule stats, new/terminated facilities, guaranteed exposure — point-in-time aggregates"],
  ["5", "Behavioral Signals", "12-month peaks (outstanding, EMI, overdue), burden delta, flat-outstanding flags, first-overdue events, continuous-overdue runs — time-series patterns"],
  ["6", "Credit Cards", "Per-card limit, utilisation, 12-month delinquency strip, overdue months, peak NPI"],
  ["7", "Red Flags", "Deterministic rule hits (e.g. 5+ NPI months, outstanding > sanction, rescheduling density)"],
  ["8", "Linked Entities", "Partners, directors, connected borrowers pulled from the CIB's ownership pages"],
  ["9", "Export", "Download a formatted Excel of the whole analysis for attaching to a credit note"],
];

export default function HowItWorks() {
  return (
    <>
      <div style={S.headline}>
        CIBxRay turns a Bangladesh Bank CIB PDF into a dashboard in about 3 seconds, entirely inside your browser.
      </div>

      <div style={S.h3}>What it does (in one breath)</div>
      <ul style={S.ul}>
        <li style={S.li}>Reads a CIB PDF you upload</li>
        <li style={S.li}>Pulls out every facility, every monthly-history row, the borrower, the guarantors, and all the linked-entity detail</li>
        <li style={S.li}>Runs 30+ analytical checks across exposure, behavioural patterns, and credit-card conduct</li>
        <li style={S.li}>Displays everything across 9 dashboard tabs a credit officer can read at a glance</li>
      </ul>

      <div style={S.h3}>The 5-step pipeline</div>
      <div style={S.diagramWrap}>
        {STEPS.map((s) => (
          <div key={s.n} style={S.step}>
            <div style={S.stepNum}>{s.n}</div>
            <div style={S.stepTitle}>{s.title}</div>
            <div style={S.stepBody}>{s.body}</div>
          </div>
        ))}
      </div>
      <div style={S.localBadge}>
        {STEPS.map((s) => (
          <div key={s.n} style={S.localCell}>{"↓ your device"}</div>
        ))}
      </div>
      <div style={S.bannerNote}>
        <strong>Key point for the banker:</strong> every one of the 5 steps happens on your own machine.
        Nothing about the CIB — the borrower's name, account numbers, balances — is ever sent to our server or to anyone else's server.
      </div>

      <div style={S.h3}>What each of the 9 tabs shows</div>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>#</th>
            <th style={S.th}>Tab</th>
            <th style={S.th}>What a credit officer sees</th>
          </tr>
        </thead>
        <tbody>
          {TABS.map(([n, tab, desc]) => (
            <tr key={n}>
              <td style={S.tdNum}>{n}</td>
              <td style={S.tdTab}>{tab}</td>
              <td style={S.td}>{desc}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={S.h3}>What we do not do</div>
      <ul style={S.ul}>
        <li style={S.li}>We do not upload your CIB to any cloud</li>
        <li style={S.li}>We do not keep a copy of anything you analyse</li>
        <li style={S.li}>We do not send any data to third parties (no analytics, no tracking, no advertising)</li>
        <li style={S.li}>Close the tab and the CIB is gone</li>
      </ul>
    </>
  );
}
