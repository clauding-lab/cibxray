import { useMemo } from 'react';
import { S } from '../../constants/theme';
import { fmt } from '../../utils/format';
import { CLS } from '../../constants/classifications';
import { analyzeCreditCards } from '../../analytics/devreq1AnalyticsPhaseC.js';

const labelStyle = { fontSize: 10, color: '#64748b', marginBottom: 3, fontWeight: 500, letterSpacing: 0.2, textTransform: 'uppercase' };
const valueStyle = { fontSize: 15, fontWeight: 700, color: '#0f172a' };
const subStyle = { fontSize: 11, color: '#475569', marginTop: 2 };
const metricCard = { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px' };
const cardHeader = { fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 };
const emptyStyle = { color: '#94a3b8', fontSize: 13, fontStyle: 'italic', padding: '20px 0', textAlign: 'center' };

function Metric({ label, value, sub }) {
  return (
    <div style={metricCard}>
      <div style={labelStyle}>{label}</div>
      <div style={valueStyle}>{value}</div>
      {sub ? <div style={subStyle}>{sub}</div> : null}
    </div>
  );
}

function monthLabel(dateStr) {
  // DD/MM/YYYY → "MMM 'YY"
  const parts = (dateStr || '').split('/');
  if (parts.length !== 3) return '';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const m = Number(parts[1]);
  if (!m || m < 1 || m > 12) return '';
  return `${months[m - 1]} '${parts[2].slice(2)}`;
}

function DelinquencyTimeline({ timeline }) {
  if (!timeline || timeline.length === 0) {
    return <div style={{ ...emptyStyle, padding: '12px 0' }}>No monthly history.</div>;
  }
  return (
    <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
      <div style={{ display: 'flex', gap: 2, minWidth: 'fit-content' }}>
        {timeline.map((row, i) => {
          const cls = CLS[row.status] || CLS.STD;
          const hasOverdue = (row.overdue || 0) > 0 || (row.npi || 0) >= 1;
          const title = `${row.dateStr} · ${cls.label}` +
            (row.outstanding != null ? ` · Out BDT ${fmt(row.outstanding)}` : '') +
            (hasOverdue ? ` · Overdue BDT ${fmt(row.overdue)} (NPI ${row.npi})` : '') +
            (row.utilization != null ? ` · Util ${row.utilization.toFixed(1)}%` : '');
          return (
            <div key={i} title={title} style={{ flex: '1 0 70px', minWidth: 70 }}>
              <div style={{
                background: cls.bg,
                borderTop: `3px solid ${cls.color}`,
                borderRadius: 4,
                padding: '6px 4px',
                textAlign: 'center',
              }}>
                <div style={{ fontSize: 10, color: cls.color, fontWeight: 700 }}>{row.status}</div>
                {row.utilization != null && (
                  <div style={{ fontSize: 10, color: '#334155', marginTop: 2 }}>{row.utilization.toFixed(0)}%</div>
                )}
                {hasOverdue && (
                  <div style={{ fontSize: 9, color: '#dc2626', marginTop: 2, fontWeight: 600 }}>NPI {row.npi}</div>
                )}
              </div>
              <div style={{ fontSize: 9, color: '#94a3b8', textAlign: 'center', marginTop: 4 }}>
                {monthLabel(row.dateStr)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function CreditCardDetails({ report, asOf = new Date() }) {
  const analytics = useMemo(
    () => analyzeCreditCards(report, { asOf, windowMonths: 12 }),
    [report, asOf]
  );
  const { cards, summary } = analytics;

  if (summary.totalCards === 0) {
    return (
      <div style={S.card}>
        <div style={S.sec}>Credit Card Details</div>
        <div style={emptyStyle}>
          No credit card facilities found in this CIB report.
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ── Portfolio Summary ────────────────────────────── */}
      <div style={S.card}>
        <div style={S.sec}>Credit Card Portfolio</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          <Metric label="Total Cards"         value={summary.totalCards}   sub={`${summary.livingCards} live · ${summary.totalCards - summary.livingCards} terminated`} />
          <Metric label="New in Last 12M"     value={summary.newCards12M} />
          <Metric label="Overall Utilization" value={summary.overallUtilization != null ? `${summary.overallUtilization.toFixed(1)}%` : '—'}
                  sub={`BDT ${fmt(summary.totalOutstanding)} / BDT ${fmt(summary.totalSanction)}`} />
          <Metric label="Total Sanction"      value={`BDT ${fmt(summary.totalSanction)}`}    sub="Living cards only" />
        </div>
      </div>

      {/* ── Per-Card Sections ────────────────────────────── */}
      {cards.map((card, idx) => (
        <div key={card.contractCode + '-' + idx} style={S.card}>
          <div style={cardHeader}>
            <div>
              {card.institution} &middot; <span style={{ color: '#475569', fontWeight: 500 }}>{card.contractCode}</span>
            </div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>
              {card.role} &middot; <span style={{ color: card.status === 'Live' ? '#059669' : '#64748b' }}>{card.status}</span>
              {card.startDate ? <> &middot; opened {card.startDate}</> : null}
            </div>
          </div>

          {/* Per-card metrics grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginBottom: 14 }}>
            <Metric label="Sanction Limit"     value={`BDT ${fmt(card.sanctionLimit)}`} />
            <Metric label="Current Outstanding" value={`BDT ${fmt(card.currentOutstanding)}`} />
            <Metric label="Current Utilization" value={card.currentUtilization != null ? `${card.currentUtilization.toFixed(1)}%` : '—'} />
            <Metric label="Avg Util. (12M)"    value={card.avgUtilization != null ? `${card.avgUtilization.toFixed(1)}%` : '—'} />
            <Metric label="Max Util. (12M)"    value={card.maxUtilization != null ? `${card.maxUtilization.toFixed(1)}%` : '—'} />
            <Metric label="Months w/ Overdue"  value={card.monthsWithOverdue} sub="last 12 months" />
            <Metric label="Months w/ NPI ≥ 1"  value={card.monthsWithNpi}     sub="last 12 months" />
            <Metric label="Peak NPI (12M)"     value={card.peakNpi} sub={card.peakNpi === 0 ? 'Clean run' : null} />
          </div>

          {/* Delinquency timeline */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#334155', marginBottom: 6 }}>
              12-Month Delinquency Timeline
            </div>
            <DelinquencyTimeline timeline={card.timeline} />
          </div>
        </div>
      ))}
    </div>
  );
}
