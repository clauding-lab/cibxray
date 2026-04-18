export function selectTopFacilities(facilities, limit = 10) {
  return [...facilities]
    .sort((a, b) => {
      const diff = (b.outstanding || 0) - (a.outstanding || 0);
      if (diff !== 0) return diff;
      const aLive = a.status === 'live' ? 0 : 1;
      const bLive = b.status === 'live' ? 0 : 1;
      if (aLive !== bLive) return aLive - bLive;
      const aFunded = a.nature === 'funded' ? 0 : 1;
      const bFunded = b.nature === 'funded' ? 0 : 1;
      return aFunded - bFunded;
    })
    .slice(0, limit);
}
