export default function ParseQualityBanner({ pq }) {
  if (!pq || pq.tier === 'ok') return null;
  const fmtN = (n) => new Intl.NumberFormat('en-IN').format(n);
  const describe = (issue) =>
    `${issue.field === 'outstanding' ? 'Outstanding' : 'Overdue'}: summary says BDT ${fmtN(issue.summaryValue)}, facilities total BDT ${fmtN(issue.computedValue)} (gap BDT ${fmtN(issue.gap)}).`;

  if (pq.tier === 'unavailable') {
    return (
      <div style={{ margin: '12px 0', padding: '12px 14px', background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 8, color: '#78350f', fontSize: 13 }}>
        Could not locate summary section in this PDF. Cross-check with the facility table skipped.
      </div>
    );
  }

  if (pq.tier === 'minor') {
    return (
      <div style={{ margin: '12px 0', padding: '12px 14px', background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, color: '#78350f', fontSize: 13 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Minor parse mismatch — score shown but verify</div>
        {pq.issues.map((i, idx) => <div key={idx}>{describe(i)}</div>)}
      </div>
    );
  }

  // major
  return (
    <div style={{ margin: '12px 0', padding: '16px 18px', background: '#fee2e2', border: '2px solid #dc2626', borderRadius: 8, color: '#7f1d1d' }}>
      <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 6 }}>Cannot score — parse incomplete</div>
      {pq.issues.map((i, idx) => <div key={idx} style={{ fontSize: 13, marginBottom: 2 }}>{describe(i)}</div>)}
      <div style={{ fontSize: 12, marginTop: 8, color: '#991b1b' }}>Please re-upload the PDF or verify manually with the original CIB.</div>
    </div>
  );
}
