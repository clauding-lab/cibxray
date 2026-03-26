import { getBand } from '../../constants/bands';

export default function Gauge({ score, override }) {
  const b = getBand(score, override);
  const pct = Math.max(score, 2) / 100;
  return (
    <svg width="160" height="100" viewBox="0 0 160 100">
      <path d="M 10 88 A 62 62 0 0 1 150 88" fill="none" stroke="#e2e8f0" strokeWidth="10" strokeLinecap="round" />
      <path d="M 10 88 A 62 62 0 0 1 150 88" fill="none" stroke={b.color} strokeWidth="10" strokeLinecap="round" strokeDasharray={(pct * 194.8) + " 194.8"} />
      <text x="80" y="76" textAnchor="middle" fontSize="30" fontWeight="700" fill={b.color}>{score}</text>
      <text x="80" y="94" textAnchor="middle" fontSize="9" fontWeight="700" fill={b.color}>{b.label}</text>
    </svg>
  );
}
