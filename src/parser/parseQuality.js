const LAKH = 100_000;

export function assessParseQuality(report) {
  const summary = report?.summary;
  if (!summary || summary.totalOutstanding == null || summary.totalOverdue == null) {
    return { tier: 'unavailable', issues: [] };
  }

  const liveFunded = (report.facilities || []).filter(
    f => f.status === 'Live' && f.nature === 'Funded'
  );
  const facOutstanding = liveFunded.reduce((s, f) => s + (Number(f.outstanding) || 0), 0);
  const facOverdue = liveFunded.reduce((s, f) => s + (Number(f.overdue) || 0), 0);

  const issues = [];
  for (const check of [
    { field: 'outstanding', summaryValue: summary.totalOutstanding, computedValue: facOutstanding },
    { field: 'overdue', summaryValue: summary.totalOverdue, computedValue: facOverdue },
  ]) {
    const gap = Math.abs(check.summaryValue - check.computedValue);
    const threshold = Math.max(check.summaryValue * 0.01, LAKH);
    const gapPct = check.summaryValue > 0 ? (gap / check.summaryValue) * 100 : 0;
    let checkTier;
    if (gap <= threshold) checkTier = 'ok';
    else if (gap <= threshold * 2) checkTier = 'minor';
    else checkTier = 'major';
    if (checkTier !== 'ok') {
      issues.push({ ...check, gap, gapPct, threshold, tier: checkTier });
    }
  }

  let tier = 'ok';
  if (issues.some(i => i.tier === 'major')) tier = 'major';
  else if (issues.some(i => i.tier === 'minor')) tier = 'minor';
  return { tier, issues };
}
