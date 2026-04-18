export function selectTopFacilities(facilities, limit = 10) {
  return [...facilities]
    .sort((a, b) => {
      const diff = (b.outstanding || 0) - (a.outstanding || 0);
      if (diff !== 0) return diff;
      const aLive = (a.status || '').toLowerCase() === 'live' ? 0 : 1;
      const bLive = (b.status || '').toLowerCase() === 'live' ? 0 : 1;
      if (aLive !== bLive) return aLive - bLive;
      const aFunded = (a.nature || '').toLowerCase() === 'funded' ? 0 : 1;
      const bFunded = (b.nature || '').toLowerCase() === 'funded' ? 0 : 1;
      return aFunded - bFunded;
    })
    .slice(0, limit);
}
