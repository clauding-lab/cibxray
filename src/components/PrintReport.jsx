import { useEffect, useState } from 'react';
import ScoreBlock from './report/ScoreBlock.jsx';
import BreakdownBars from './report/BreakdownBars.jsx';
import ParseQualityBanner from './report/ParseQualityBanner.jsx';
import AuditStamp from './AuditStamp.jsx';
import LoanSummaryTable from './print/LoanSummaryTable.jsx';
import { filterCompaniesOnly } from '../analytics/devreq2Analytics.js';

const STORAGE_KEY = 'cibxray.printPayload';
const STALE_AFTER_MS = 10_000; // payload must have been written within the last 10s

const pageStyle = {
  width: '188mm',
  minHeight: '273mm',
  margin: '0 auto',
  padding: '0',
  background: 'white',
  color: '#0f172a',
  fontFamily: 'system-ui, -apple-system, sans-serif',
  fontSize: 12,
  display: 'flex',
  flexDirection: 'column',
};

const headerStyle = {
  paddingBottom: 12,
  borderBottom: '2px solid #0f172a',
  marginBottom: 16,
};

const borrowerNameStyle = {
  fontSize: 20,
  fontWeight: 700,
  margin: 0,
};

const dateStyle = {
  fontSize: 11,
  color: '#64748b',
  marginTop: 4,
};

const sectionGapStyle = { marginBottom: 16 };

export default function PrintReport() {
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setError('No report to print. Re-upload the PDF.');
        return;
      }
      const parsed = JSON.parse(raw);
      const age = Date.now() - (parsed.writtenAt || 0);
      if (age > STALE_AFTER_MS) {
        // Stale handoff (user reloaded /#print, or opened it directly).
        localStorage.removeItem(STORAGE_KEY);
        setError('No report to print. Re-upload the PDF.');
        return;
      }
      // Consume: remove immediately so a reload shows the error state,
      // not a second print of the same payload.
      localStorage.removeItem(STORAGE_KEY);
      setPayload(parsed);
    } catch (e) {
      setError('Could not load report data.');
    }
  }, []);

  useEffect(() => {
    if (!payload) return;
    const timer = setTimeout(() => window.print(), 300);
    return () => clearTimeout(timer);
  }, [payload]);

  if (error) {
    return (
      <div className="print-root" style={{ padding: 32, fontFamily: 'system-ui', textAlign: 'center' }}>
        <h2>Print unavailable</h2>
        <p>{error}</p>
        <p><a href="/">Return to CIBxRay</a></p>
      </div>
    );
  }

  if (!payload) return null;

  const { report, reports, score, band } = payload;
  // reports may be an array (multi-PDF context) or absent (single-PDF context)
  const allReports = Array.isArray(reports) ? reports : (report ? [report] : []);
  const isMultiPdf = allReports.length > 1;
  const companyReports = filterCompaniesOnly(allReports);
  const groupFacilities = companyReports.flatMap(r => r.facilities || []);

  // report.subject.displayName is the canonical display name used throughout the app
  // report.inquiryDate holds the CIB inquiry/reporting date (no summary.reportingDate field exists)
  const borrowerName = report?.subject?.displayName ?? 'Unknown borrower';
  const inquiryDate = report?.inquiryDate ?? '—';

  return (
    <div className="print-root" style={pageStyle}>
      <header style={headerStyle}>
        <h1 style={borrowerNameStyle}>{borrowerName}</h1>
        <div style={dateStyle}>
          CIB reporting date: {inquiryDate}
        </div>
      </header>

      <section style={sectionGapStyle}>
        <ScoreBlock score={score} band={band} dataTierNote={score?.dataTierNote} variant="print" />
      </section>

      {report?.parseQuality && report.parseQuality.tier !== 'ok' && (
        <section style={sectionGapStyle}>
          <ParseQualityBanner pq={report.parseQuality} />
        </section>
      )}

      <section style={sectionGapStyle}>
        <BreakdownBars score={score} band={band} variant="print" />
      </section>

      {/* Applying Concern Summary — always rendered (spec §6, §12 Q4) */}
      <section style={{ ...sectionGapStyle }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 6px 0' }}>Applying Concern: Liability Summary</h2>
        <LoanSummaryTable facilities={report?.facilities ?? []} />
      </section>

      {/* Group Summary — only in multi-PDF (wholesale) context (spec §6) */}
      {isMultiPdf && (
        <section style={{ ...sectionGapStyle, flex: 1 }}>
          <h2 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 6px 0' }}>Group: Liability Summary</h2>
          <LoanSummaryTable
            facilities={groupFacilities}
            caption="Here Group CIB includes only the company not individual loans"
          />
        </section>
      )}

      <AuditStamp stamp={report?.stamp} />
    </div>
  );
}
