import { useMemo } from 'react';
import { S } from '../../constants/theme';
import { fmt } from '../../utils/format';
import {
  findUnchangedOutstandingFacilities,
  findSuddenOverdueEvents,
  findContinuousOverdueFacilities,
  computePeakExposure,
  computePeakEmi,
  computeBurdenDelta,
} from '../../analytics/devreq1AnalyticsPhaseB.js';

const labelStyle = { fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 500, letterSpacing: 0.2, textTransform: 'uppercase' };
const valueStyle = { fontSize: 16, fontWeight: 700, color: '#0f172a' };
const subStyle = { fontSize: 12, color: '#475569', marginTop: 3 };
const metricCard = { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px' };
const sectionSub = { fontSize: 12, fontWeight: 600, color: '#334155', margin: '14px 0 8px' };
const emptyText = { color: '#94a3b8', fontSize: 12, fontStyle: 'italic', padding: '8px 0' };
const thStyle = { textAlign: 'left', padding: '6px 8px', color: '#64748b', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' };
const tdStyle = { padding: '6px 8px', fontSize: 12, borderBottom: '1px solid #f1f5f9', verticalAlign: 'top' };

function Metric({ label, value, sub }) {
  return (
    <div style={metricCard}>
      <div style={labelStyle}>{label}</div>
      <div style={valueStyle}>{value}</div>
      {sub ? <div style={subStyle}>{sub}</div> : null}
    </div>
  );
}

function PatternTable({ headers, rows }) {
  if (rows.length === 0) return <div style={emptyText}>None detected.</div>;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>{headers.map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((c, j) => <td key={j} style={tdStyle}>{c}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Delta({ value, flipColor = false }) {
  if (value === 0) return <span style={{ color: '#64748b' }}>·</span>;
  const isUp = value > 0;
  // Default: increase is "concerning" (red), decrease is "good" (green).
  // flipColor reverses (e.g., if increase is good in some context).
  const color = (isUp !== flipColor) ? '#dc2626' : '#059669';
  const arrow = isUp ? '▲' : '▼';
  return <span style={{ color, fontWeight: 600 }}>{arrow} BDT {fmt(Math.abs(value))}</span>;
}

export default function ExposureTrends({ report, asOf = new Date() }) {
  const analytics = useMemo(() => ({
    peakInst: computePeakExposure(report, 'installment'),
    peakNonInst: computePeakExposure(report, 'nonInstallment'),
    peakAll: computePeakExposure(report, 'all'),
    peakEmi: computePeakEmi(report),
    burden: computeBurdenDelta(report, { months: 12, asOf }),
    unchanged: findUnchangedOutstandingFacilities(report, { minConsecutive: 3 }),
    sudden: findSuddenOverdueEvents(report),
    continuous: findContinuousOverdueFacilities(report, { minConsecutive: 2, escalateAt: 3 }),
  }), [report, asOf]);

  const { peakInst, peakNonInst, peakAll, peakEmi, burden, unchanged, sudden, continuous } = analytics;
  const peakSub = p => p.peakMonth ? `in ${p.peakMonth} (across ${p.months} observed month${p.months === 1 ? '' : 's'})` : 'No monthly history';
  const historyMissing = burden.then.outstanding === 0 && burden.then.emi === 0 &&
    report.facilities.some(f => (f.history || []).length > 0);

  return (
    <div>
      {/* ── Portfolio Peaks ───────────────────────────────── */}
      <div style={S.card}>
        <div style={S.sec}>Portfolio Peak Exposure</div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: -6, marginBottom: 14 }}>
          Maximum observed within the CIB's monthly history window (typically 12–24 months; not a lifetime maximum).
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
          <Metric label="Peak Term Loan Exposure"            value={`৳${fmt(peakInst.peakAmount)}`}    sub={peakSub(peakInst)} />
          <Metric label="Peak Non-Installment Exposure"      value={`৳${fmt(peakNonInst.peakAmount)}`} sub={peakSub(peakNonInst)} />
          <Metric label="Peak Cumulative Exposure"           value={`৳${fmt(peakAll.peakAmount)}`}     sub={peakSub(peakAll)} />
          <Metric label="Peak Cumulative EMI (Monthly)"      value={`৳${fmt(peakEmi.peakAmount)}`}     sub={peakSub(peakEmi)} />
        </div>
      </div>

      {/* ── 12-Month Burden Delta ────────────────────────── */}
      <div style={S.card}>
        <div style={S.sec}>12-Month Burden Change</div>
        {historyMissing ? (
          <div style={emptyText}>12-month-ago snapshot not available (CIB history may not cover that far back).</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 10 }}>
            <div style={metricCard}>
              <div style={labelStyle}>Outstanding</div>
              <div style={{ ...valueStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span>BDT {fmt(burden.today.outstanding)}</span>
                <Delta value={burden.outstandingDelta} />
              </div>
              <div style={subStyle}>
                Today &middot; vs {burden.targetMonth}: BDT {fmt(burden.then.outstanding)}
              </div>
            </div>
            <div style={metricCard}>
              <div style={labelStyle}>Monthly EMI</div>
              <div style={{ ...valueStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span>BDT {fmt(burden.today.emi)}</span>
                <Delta value={burden.emiDelta} />
              </div>
              <div style={subStyle}>
                Today &middot; vs {burden.targetMonth}: BDT {fmt(burden.then.emi)}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Historical Patterns ──────────────────────────── */}
      <div style={S.card}>
        <div style={S.sec}>Historical Pattern Flags</div>

        <div style={sectionSub}>
          Unchanged Outstanding &nbsp;
          <span style={{ color: '#94a3b8', fontWeight: 400 }}>
            ({unchanged.length} flag{unchanged.length === 1 ? '' : 's'})
          </span>
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400, marginTop: 2 }}>
            Facility balance identical for ≥ 3 consecutive months with zero overdue and zero unpaid installments — possible parked-loan signature.
          </div>
        </div>
        <PatternTable
          headers={['Contract', 'Institution', 'Type', 'Value', 'Period', 'Months']}
          rows={unchanged.map(u => [u.contractCode, u.institution, u.type, `৳${fmt(u.flatValue)}`, `${u.fromDate} → ${u.toDate}`, u.monthCount])}
        />

        <div style={sectionSub}>
          Sudden Overdue Events &nbsp;
          <span style={{ color: '#94a3b8', fontWeight: 400 }}>
            ({sudden.length} event{sudden.length === 1 ? '' : 's'})
          </span>
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400, marginTop: 2 }}>
            Month-over-month transition from 0 unpaid installments to ≥ 1 — first entries into overdue on a facility.
          </div>
        </div>
        <PatternTable
          headers={['Contract', 'Institution', 'Type', 'Date', 'Overdue', 'NPI', 'Status']}
          rows={sudden.map(s => [s.contractCode, s.institution, s.type, s.date, `৳${fmt(s.overdueAmount)}`, s.npi, s.classification])}
        />

        <div style={sectionSub}>
          Continuous Overdue Runs &nbsp;
          <span style={{ color: '#94a3b8', fontWeight: 400 }}>
            ({continuous.length} run{continuous.length === 1 ? '' : 's'})
          </span>
          <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 400, marginTop: 2 }}>
            Facility remained overdue for ≥ 2 consecutive accounting dates. "Escalated" marks runs of ≥ 3 months.
          </div>
        </div>
        <PatternTable
          headers={['Contract', 'Institution', 'Type', 'Period', 'Months', 'Peak NPI', 'Escalated']}
          rows={continuous.map(c => [
            c.contractCode,
            c.institution,
            c.type,
            `${c.fromDate} → ${c.toDate}`,
            c.monthCount,
            c.peakNpi,
            c.escalated ? <span style={{ color: '#dc2626', fontWeight: 600 }}>Yes</span> : 'No',
          ])}
        />
      </div>
    </div>
  );
}
