import { useMemo } from 'react';
import { S } from '../../constants/theme';
import { fmt } from '../../utils/format';
import {
  computeLiveLoansEmi,
  computeRescheduleStats,
  computeNewInstallmentFacilities,
  computeNewNonInstallmentFacilities,
  computeGuaranteedInstallmentExposure,
  computeGuaranteedNonInstallmentExposure,
  computeTerminatedInstallmentCount,
} from '../../analytics/devreq1Analytics.js';

const labelStyle = { fontSize: 11, color: '#64748b', marginBottom: 4, fontWeight: 500, letterSpacing: 0.2, textTransform: 'uppercase' };
const valueStyle = { fontSize: 16, fontWeight: 700, color: '#0f172a' };
const subStyle = { fontSize: 12, color: '#475569', marginTop: 3 };
const metricCard = { background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px' };

function Metric({ label, value, sub }) {
  return (
    <div style={metricCard}>
      <div style={labelStyle}>{label}</div>
      <div style={valueStyle}>{value}</div>
      {sub ? <div style={subStyle}>{sub}</div> : null}
    </div>
  );
}

export default function BehavioralSignals({ report, asOf = new Date() }) {
  const metrics = useMemo(() => ({
    liveEmi: computeLiveLoansEmi(report),
    reschedule: computeRescheduleStats(report),
    newInst: computeNewInstallmentFacilities(report, { months: 24, asOf }),
    newNonInst: computeNewNonInstallmentFacilities(report, { months: 24, asOf }),
    guarInst: computeGuaranteedInstallmentExposure(report),
    guarNonInst: computeGuaranteedNonInstallmentExposure(report),
    terminatedCount: computeTerminatedInstallmentCount(report),
  }), [report, asOf]);

  const reschB = metrics.reschedule.asBorrower;
  const reschG = metrics.reschedule.asGuarantor;
  const reschValue = stats => stats.count === 0 ? 'None' : `${stats.count}×`;
  const reschSub = stats => stats.count === 0 ? null : (stats.lastDate ? `Last: ${stats.lastDate}` : null);

  return (
    <div style={S.card}>
      <div style={S.sec}>Exposure Analytics</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
        <Metric
          label="Live Loans EMI (Monthly)"
          value={`৳${fmt(metrics.liveEmi)}`}
          sub="Sum of installment amount across live Borrower/Co-Borrower facilities"
        />
        <Metric
          label="Guaranteed Installment Exposure"
          value={`৳${fmt(metrics.guarInst)}`}
          sub="Live installment facilities where role is Guarantor"
        />
        <Metric
          label="Guaranteed Non-Installment Exposure"
          value={`৳${fmt(metrics.guarNonInst)}`}
          sub="Live CC/OD/demand loan facilities where role is Guarantor"
        />
        <Metric
          label="New Installment Facilities (Last 24M)"
          value={`${metrics.newInst.count} facilit${metrics.newInst.count === 1 ? 'y' : 'ies'}`}
          sub={`Total sanction: ৳${fmt(metrics.newInst.totalAmount)}`}
        />
        <Metric
          label="New Non-Installment Facilities (Last 24M)"
          value={`${metrics.newNonInst.count} facilit${metrics.newNonInst.count === 1 ? 'y' : 'ies'}`}
          sub={`Total sanction: ৳${fmt(metrics.newNonInst.totalAmount)}`}
        />
        <Metric
          label="Terminated Installment Loans"
          value={`${metrics.terminatedCount}`}
          sub="Includes terminated-in-advance"
        />
        <Metric
          label="Reschedules — As Borrower/Co-Borrower"
          value={reschValue(reschB)}
          sub={reschSub(reschB)}
        />
        <Metric
          label="Reschedules — As Guarantor"
          value={reschValue(reschG)}
          sub={reschSub(reschG)}
        />
      </div>
    </div>
  );
}
