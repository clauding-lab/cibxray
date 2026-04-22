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
  olWrap: { margin: 0, paddingLeft: 0, listStyle: "none", color: "#cbd5e1" },
  olItem: {
    display: "grid",
    gridTemplateColumns: "28px 1fr",
    gap: 10,
    padding: "10px 0",
    borderBottom: "1px solid rgba(56,189,248,0.1)",
  },
  olNum: {
    background: "rgba(14,165,233,0.15)",
    border: "1px solid rgba(56,189,248,0.3)",
    color: "#38bdf8",
    width: 26, height: 26,
    borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 12, fontWeight: 700,
    flexShrink: 0,
  },
  olBody: { fontSize: 13, color: "#cbd5e1", lineHeight: 1.55 },
  olHead: { color: "#e0f2fe", fontWeight: 700, display: "block", marginBottom: 2 },
  ul: { margin: 0, paddingLeft: 20, color: "#cbd5e1" },
  li: { marginBottom: 4 },
  flowWrap: {
    marginTop: 10,
    padding: 16,
    background: "rgba(2,6,23,0.4)",
    border: "1px solid rgba(56,189,248,0.15)",
    borderRadius: 8,
    display: "grid",
    gap: 10,
  },
  flowRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  flowBox: {
    background: "linear-gradient(180deg, rgba(14,165,233,0.2) 0%, rgba(14,165,233,0.05) 100%)",
    border: "1px solid rgba(56,189,248,0.3)",
    borderRadius: 8,
    padding: "10px 12px",
    fontSize: 12.5,
    color: "#e0f2fe",
    flex: 1,
    minWidth: 0,
  },
  flowArrow: {
    color: "#38bdf8",
    fontSize: 18,
    textAlign: "center",
    fontWeight: 700,
  },
  flowLabel: { fontWeight: 700, color: "#e0f2fe" },
  flowSub: { fontSize: 11.5, color: "#94a3b8", marginTop: 3 },
  flowAside: {
    flex: 1.2,
    fontSize: 11.5,
    color: "#94a3b8",
    padding: "0 8px",
  },
  flowAsideHdr: {
    color: "#7dd3fc",
    fontWeight: 700,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontSize: 10.5,
  },
  noDenyBanner: {
    background: "rgba(5,150,105,0.08)",
    border: "1px solid rgba(16,185,129,0.25)",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 12.5,
    color: "#a7f3d0",
    marginTop: 8,
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
  tdHdr: {
    padding: "8px 10px",
    borderBottom: "1px solid rgba(56,189,248,0.1)",
    color: "#e0f2fe",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
};

const GUARANTEES = [
  {
    head: "The CIB never leaves your browser.",
    body: "PDF reading, text extraction, parsing, and analysis all happen locally. Our server only serves the empty app shell and checks your access code.",
  },
  {
    head: "Access-code protected.",
    body: "A shared access code (given to authorised users only) is required to open the app. Sessions last 48 hours and are signed with an HMAC secret, so they cannot be forged.",
  },
  {
    head: "Brute-force throttled.",
    body: "5 wrong codes from the same IP in 15 minutes → locked out. Each failed attempt costs a 1-second delay.",
  },
  {
    head: "All traffic encrypted.",
    body: "Strict-Transport-Security with 2-year preload — browsers are forced to use HTTPS, forever.",
  },
  {
    head: "Strict Content Security Policy.",
    body: "The browser is instructed to refuse any script, image, or request that isn't from our own domain. No third-party trackers, ad networks, or injected code can run — even if someone tried.",
  },
];

const HEADERS = [
  ["Content-Security-Policy", "Any script, image, or network call that isn't from cibxray itself is blocked — even if a hacker managed to inject code"],
  ["Strict-Transport-Security", "The browser refuses to load the site over plain HTTP, forever — prevents downgrade attacks"],
  ["X-Content-Type-Options: nosniff", "The browser can't be tricked into running a file as code if it isn't"],
  ["Referrer-Policy", "Your CIBxRay URL isn't leaked to other sites you click through to"],
  ["Permissions-Policy", "Camera, microphone, geolocation, USB are all disabled — the app can't ask for them even if compromised"],
];

export default function Security() {
  return (
    <>
      <div style={S.headline}>
        CIBxRay was designed so that even if our server were compromised, no customer data could be leaked — because no customer data ever reaches our server.
      </div>

      <div style={S.h3}>The 5 security guarantees</div>
      <ol style={S.olWrap}>
        {GUARANTEES.map((g, i) => (
          <li key={i} style={S.olItem}>
            <div style={S.olNum}>{i + 1}</div>
            <div style={S.olBody}>
              <span style={S.olHead}>{g.head}</span>
              {g.body}
            </div>
          </li>
        ))}
      </ol>

      <div style={S.h3}>Defence-in-depth flow</div>
      <div style={S.flowWrap}>
        <div style={S.flowRow}>
          <div style={S.flowBox}>
            <div style={S.flowLabel}>Your browser</div>
            <div style={S.flowSub}>HTTPS only (HSTS 2-year preload)</div>
          </div>
        </div>
        <div style={S.flowArrow}>{"↓"}</div>
        <div style={S.flowRow}>
          <div style={S.flowBox}>
            <div style={S.flowLabel}>Vercel edge</div>
            <div style={S.flowSub}>TLS, DDoS protection</div>
          </div>
          <div style={S.flowAside}>
            <div style={S.flowAsideHdr}>5 security headers served</div>
            • CSP (strict)<br />
            • HSTS preload<br />
            • X-Content-Type-Options<br />
            • Referrer-Policy<br />
            • Permissions-Policy
          </div>
        </div>
        <div style={S.flowArrow}>{"↓"}</div>
        <div style={S.flowRow}>
          <div style={S.flowBox}>
            <div style={S.flowLabel}>Middleware</div>
            <div style={S.flowSub}>Valid 48h session? If not → login page (rate-limited 5 / 15 min)</div>
          </div>
        </div>
        <div style={S.flowArrow}>{"↓"}</div>
        <div style={S.flowRow}>
          <div style={S.flowBox}>
            <div style={S.flowLabel}>App shell (HTML/JS/CSS) served to your device</div>
            <div style={S.flowSub}>
              The CIB PDF you upload <strong style={{ color: "#fca5a5" }}>stops here</strong> — it is opened,
              parsed, and analysed 100% inside your browser tab. It is never uploaded anywhere.
            </div>
          </div>
        </div>
      </div>

      <div style={S.h3}>What we explicitly do not have</div>
      <ul style={S.ul}>
        <li style={S.li}><strong style={{ color: "#e0f2fe" }}>No database.</strong> There is no "customer table" to be stolen.</li>
        <li style={S.li}><strong style={{ color: "#e0f2fe" }}>No file storage.</strong> No S3 bucket, no blob store, no CIB archive.</li>
        <li style={S.li}><strong style={{ color: "#e0f2fe" }}>No analytics or tracking.</strong> No Google Analytics, no Meta Pixel, no Mixpanel, no heatmaps.</li>
        <li style={S.li}><strong style={{ color: "#e0f2fe" }}>No logging of CIB contents.</strong> Our server never sees the CIB, so it cannot log it.</li>
        <li style={S.li}><strong style={{ color: "#e0f2fe" }}>No third-party embeds.</strong> No ads, no external widgets, no remote fonts or scripts.</li>
      </ul>

      <div style={S.h3}>What the browser protections actually block (plain English)</div>
      <table style={S.table}>
        <thead>
          <tr>
            <th style={S.th}>Header</th>
            <th style={S.th}>What it prevents</th>
          </tr>
        </thead>
        <tbody>
          {HEADERS.map(([h, what]) => (
            <tr key={h}>
              <td style={S.tdHdr}>{h}</td>
              <td style={S.td}>{what}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
