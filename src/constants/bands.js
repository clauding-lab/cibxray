export const BANDS = [
  { min: 80, max: 100, key: "LOW",          label: "LOW RISK",      color: "#059669", bg: "#ecfdf5", desc: "Clean record. Standard processing." },
  { min: 60, max: 79,  key: "MODERATE",      label: "MODERATE",      color: "#0284c7", bg: "#f0f9ff", desc: "Acceptable with minor flags. Standard with monitoring." },
  { min: 40, max: 59,  key: "ELEVATED",      label: "ELEVATED",      color: "#d97706", bg: "#fffbeb", desc: "Material concerns. Enhanced due diligence required." },
  { min: 20, max: 39,  key: "HIGH",          label: "HIGH RISK",     color: "#dc2626", bg: "#fef2f2", desc: "Significant adverse signals. Decline unless exceptional approval." },
  { min: -1, max: 19,  key: "UNACCEPTABLE",  label: "UNACCEPTABLE",  color: "#991b1b", bg: "#fecaca", desc: "Live adverse classification. Auto-decline." },
];

export const getBand = (score, override) => {
  if (override) return BANDS.find(b => b.key === override) || BANDS[4];
  return BANDS.find(b => score >= b.min && score <= b.max) || BANDS[4];
};
