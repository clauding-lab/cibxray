import { selectTopFacilities } from './selectTopFacilities.js';
import { fmt } from '../../utils/format.js';
import { S } from '../../constants/theme.js';
import FacTable from '../shared/FacTable.jsx';
import FacSummaryBar from '../shared/FacSummaryBar.jsx';
import RepaymentChart from '../shared/RepaymentChart.jsx';

export default function FacilityTable({ facilities, variant = 'screen' }) {
  if (variant === 'print') {
    const rows = selectTopFacilities(facilities, 10);
    const truncated = facilities.length > rows.length;

    return (
      <div data-testid="facility-table">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'sans-serif' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #000' }}>
              {['Bank', 'Facility', 'Classification', 'Outstanding', 'Overdue'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '5px 6px', fontWeight: 700 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((f, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #ccc' }}>
                <td style={{ padding: '4px 6px' }}>{f.institution}</td>
                <td style={{ padding: '4px 6px' }}>{f.type}</td>
                <td style={{ padding: '4px 6px', fontWeight: 600 }}>{f.classification}</td>
                <td style={{ padding: '4px 6px', fontFamily: 'monospace' }}>{'\u09F3'}{fmt(f.outstanding)}</td>
                <td style={{ padding: '4px 6px', fontFamily: 'monospace', color: f.overdue > 0 ? '#dc2626' : 'inherit' }}>
                  {f.overdue > 0 ? `\u09F3${fmt(f.overdue)}` : '\u2014'}
                </td>
              </tr>
            ))}
            {truncated && (
              <tr>
                <td colSpan={5} style={{ padding: '4px 6px', fontStyle: 'italic', color: '#64748b' }}>
                  {facilities.length - rows.length} more facilities — see source CIB PDF
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    );
  }

  // SCREEN variant — preserved verbatim from App.jsx borrower tab
  const liveBorrower = facilities.filter(f => f.status === "Live");
  const termBorrower = facilities.filter(f => f.status !== "Live");
  const liveFunded = liveBorrower.filter(f => f.nature === "Funded");
  const liveNonFunded = liveBorrower.filter(f => f.nature === "Non-Funded");
  const termFunded = termBorrower.filter(f => f.nature === "Funded");
  const termNonFunded = termBorrower.filter(f => f.nature === "Non-Funded");

  return (
    <div data-testid="facility-table">
      <FacSummaryBar facs={facilities} />
      <RepaymentChart facs={facilities.filter(f => f.nature === "Funded")} title="Funded Facilities — Repayment Timeline" />
      <RepaymentChart facs={facilities.filter(f => f.nature === "Non-Funded")} title="Non-Funded Facilities — Exposure Timeline" />
      <>
        <div style={S.card}>
          <div style={{ ...S.sec, color: "#059669" }}>Live Facilities ({liveBorrower.length})</div>
          {liveBorrower.length > 0 ? (
            <>
              {liveFunded.length > 0 && (
                <div style={{ marginBottom: liveNonFunded.length > 0 ? 16 : 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ background: "#dbeafe", padding: "1px 8px", borderRadius: 4, fontSize: 10 }}>Funded</span>
                    <span style={{ color: "#94a3b8", fontWeight: 400 }}>({liveFunded.length})</span>
                  </div>
                  <FacTable facs={liveFunded} showTotals />
                </div>
              )}
              {liveNonFunded.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#15803d", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ background: "#f0fdf4", padding: "1px 8px", borderRadius: 4, fontSize: 10 }}>Non-Funded</span>
                    <span style={{ color: "#94a3b8", fontWeight: 400 }}>({liveNonFunded.length})</span>
                  </div>
                  <FacTable facs={liveNonFunded} showTotals />
                </div>
              )}
            </>
          ) : <p style={{ color: "#94a3b8", fontSize: 12 }}>No live borrower facilities.</p>}
        </div>
        <div style={S.card}>
          <div style={{ ...S.sec, color: "#64748b" }}>Terminated / Settled Facilities ({termBorrower.length})</div>
          {termBorrower.length > 0 ? (
            <>
              {termFunded.length > 0 && (
                <div style={{ marginBottom: termNonFunded.length > 0 ? 16 : 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ background: "#dbeafe", padding: "1px 8px", borderRadius: 4, fontSize: 10 }}>Funded</span>
                    <span style={{ color: "#94a3b8", fontWeight: 400 }}>({termFunded.length})</span>
                  </div>
                  <FacTable facs={termFunded} showTotals />
                </div>
              )}
              {termNonFunded.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#15803d", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ background: "#f0fdf4", padding: "1px 8px", borderRadius: 4, fontSize: 10 }}>Non-Funded</span>
                    <span style={{ color: "#94a3b8", fontWeight: 400 }}>({termNonFunded.length})</span>
                  </div>
                  <FacTable facs={termNonFunded} showTotals />
                </div>
              )}
            </>
          ) : <p style={{ color: "#94a3b8", fontSize: 12 }}>No terminated borrower facilities.</p>}
        </div>
      </>
    </div>
  );
}
