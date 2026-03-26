export const fmt = (n) => {
  if (n >= 1e7) return (n / 1e7).toFixed(2) + " Cr";
  if (n >= 1e5) return (n / 1e5).toFixed(2) + " Lac";
  return Number(n || 0).toLocaleString("en-IN");
};
