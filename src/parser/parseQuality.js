const LAKH = 100_000;

export function assessParseQuality(report) {
  const summary = report?.summary;
  if (!summary || summary.totalOutstanding == null || summary.totalOverdue == null) {
    return { tier: 'unavailable', issues: [] };
  }

  // The summary's totalOutstanding / totalOverdue covers ALL live credit
  // exposure on the subject — funded (OD/CC/TL) AND non-funded (LC/BG/BLW) —
  // but only where the subject is the borrower or co-borrower. Guarantor
  // positions appear on the CIB but are NOT counted in the headline totals.
  // Reconciliation therefore sums: status=Live AND role!=Guarantor, including
  // both Funded and Non-Funded natures. (Scoring, in contrast, uses only
  // Funded — that is correct and unchanged; credit-risk scoring treats
  // contingent non-funded exposure differently from principal obligations.)
  const liveSubject = (report.facilities || []).filter(
    f => f.status === 'Live' && f.role !== 'Guarantor'
  );
  const facOutstanding = liveSubject.reduce((s, f) => s + (Number(f.outstanding) || 0), 0);
  const facOverdue = liveSubject.reduce((s, f) => s + (Number(f.overdue) || 0), 0);

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
