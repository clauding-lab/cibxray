// DevReq-1 Phase C analytics — credit card portfolio + per-card
// 12-month payment behavior (item 16).
//
// Per the 2026-04-22 CRM-CD resolution, the Credit Card Details tab must
// surface all six payment-behavior metrics per card:
//   (a) 12-month delinquency timeline (STD/SMA/SS/... per month)
//   (b) count of months with any overdue > 0 in the last 12
//   (c) count of months with NPI ≥ 1 in the last 12
//   (d) peak NPI in the last 12 months
//   (e) average utilization % over the last 12 months
//   (f) maximum utilization % over the last 12 months

import { parseCibDate, isWithinMonths } from './devreq1Analytics.js';

export function isCreditCardFacility(facility) {
  return /credit\s*card/i.test(String(facility?.type || ''));
}

// Per-card 12M analysis.
export function analyzeCreditCard(facility, { asOf = new Date(), windowMonths = 12 } = {}) {
  const history = facility.history || [];
  // history is oldest → newest; "last N months" = array tail.
  const window = history.slice(-windowMonths);

  let monthsWithOverdue = 0;
  let monthsWithNpi = 0;
  let peakNpi = 0;
  const utilizations = [];

  const timeline = window.map((r) => {
    if ((r.overdue || 0) > 0) monthsWithOverdue += 1;
    if ((r.npi || 0) >= 1) monthsWithNpi += 1;
    if ((r.npi || 0) > peakNpi) peakNpi = r.npi || 0;
    const util = (r.limit || 0) > 0 ? (r.outstanding / r.limit) * 100 : null;
    if (util !== null) utilizations.push(util);
    return {
      dateStr: r.dateStr,
      status: r.status,
      outstanding: r.outstanding,
      overdue: r.overdue,
      npi: r.npi,
      utilization: util,
    };
  });

  const avgUtilization = utilizations.length > 0
    ? utilizations.reduce((s, u) => s + u, 0) / utilizations.length
    : null;
  const maxUtilization = utilizations.length > 0 ? Math.max(...utilizations) : null;

  return {
    contractCode: facility.contractCode,
    institution: facility.institution,
    role: facility.role,
    status: facility.status,
    type: facility.type,
    startDate: facility.startDate,
    sanctionLimit: facility.limit,
    currentOutstanding: facility.outstanding,
    currentUtilization: (facility.limit || 0) > 0
      ? (facility.outstanding / facility.limit) * 100
      : null,
    timeline,
    monthsWithOverdue,
    monthsWithNpi,
    peakNpi,
    avgUtilization,
    maxUtilization,
  };

  // asOf/windowMonths parameters are exposed for future date-window
  // filtering (currently the function uses history array tail). The
  // arguments are intentionally accepted so callers pin the expected
  // window for consistency with Phase B analytics.
}

export function analyzeCreditCards(report, { asOf = new Date(), windowMonths = 12 } = {}) {
  const cards = (report.facilities || []).filter(isCreditCardFacility);
  const cardAnalyses = cards.map((c) => analyzeCreditCard(c, { asOf, windowMonths }));

  const livingCards = cards.filter((c) => c.status === 'Live');
  const newCards12M = cards.filter((c) => {
    const sd = parseCibDate(c.startDate);
    return sd && isWithinMonths(sd, windowMonths, asOf);
  });

  const totalSanction = livingCards.reduce((s, c) => s + (c.limit || 0), 0);
  const totalOutstanding = livingCards.reduce((s, c) => s + (c.outstanding || 0), 0);

  return {
    cards: cardAnalyses,
    summary: {
      totalCards: cards.length,
      livingCards: livingCards.length,
      newCards12M: newCards12M.length,
      totalSanction,
      totalOutstanding,
      overallUtilization: totalSanction > 0 ? (totalOutstanding / totalSanction) * 100 : null,
    },
  };
}
