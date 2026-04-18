import { formatDhakaTimestamp } from '../stamp/formatDhaka.js';

const containerStyle = {
  borderTop: '1px solid #e2e8f0',
  marginTop: 24,
  paddingTop: 12,
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '4px 24px',
  fontSize: 11,
  color: '#64748b',
};

const mono = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' };

export default function AuditStamp({ stamp }) {
  if (!stamp) return null;
  return (
    <div style={containerStyle} data-testid="audit-stamp">
      <span>Analysed {formatDhakaTimestamp(stamp.analyzedAt)} Asia/Dhaka</span>
      <span>Methodology {stamp.methodologyVersion}</span>
      <span>App build <span style={mono}>{stamp.appBuild}</span></span>
      <span>PDF <span style={mono}>{stamp.pdfFingerprint}</span></span>
    </div>
  );
}
