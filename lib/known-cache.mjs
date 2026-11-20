// Keeps the list of cards in memory for a while. Firestore bills one read per card, so reading the whole notebook on
// every save or search is costly (600 cards = 600 reads). Used only in Firestore mode; inbox.json is read fresh.
export function createRowsCache({ ttlMs = 10 * 60_000, now = () => Date.now() } = {}) {
  let rows = null, at = 0;
  return {
    async get(load) {
      if (rows && now() - at < ttlMs) return rows;
      rows = await load(); at = now();
      return rows;
    },
    add(items) { if (rows) rows = [...rows, ...items]; },   // cards we just saved
    reset() { rows = null; },                                // after a failure: do not trust it
  };
}
