import { useEffect, useState } from 'react';
import ScoreBlock from './report/ScoreBlock.jsx';
import BreakdownBars from './report/BreakdownBars.jsx';
import FacilityTable from './report/FacilityTable.jsx';
import AuditStamp from './AuditStamp.jsx';

const SESSION_KEY = 'cibxray.printPayload';

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
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) {
        setError('No report to print. Re-upload the PDF.');
        return;
      }
      setPayload(JSON.parse(raw));
    } catch (e) {
      setError('Could not load report data.');
    }
  }, []);

  useEffect(() => {
    if (!payload) return;
    const handleBeforeUnload = () => sessionStorage.removeItem(SESSION_KEY);
    window.addEventListener('beforeunload', handleBeforeUnload);
    const timer = setTimeout(() => window.print(), 300);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      clearTimeout(timer);
    };
  }, [payload]);

  if (error) {
    return (
      <div style={{ padding: 32, fontFamily: 'system-ui', textAlign: 'center' }}>
        <h2>Print unavailable</h2>
        <p>{error}</p>
        <p><a href="/">Return to CIBxRay</a></p>
      </div>
    );
  }

  if (!payload) return null;

  const { report, score, band } = payload;

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

      <section style={sectionGapStyle}>
        <BreakdownBars score={score} variant="print" />
      </section>

      <section style={{ ...sectionGapStyle, flex: 1 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, margin: '0 0 8px 0' }}>Top facilities (by outstanding)</h2>
        <FacilityTable facilities={report?.facilities ?? []} variant="print" />
      </section>

      <AuditStamp stamp={report?.stamp} />
    </div>
  );
}
