/**
 * Generate all possible doubles matchups for N players.
 * Each matchup is { teamA: [p1, p2], teamB: [p3, p4] }.
 */
export function generateAllMatchups(players) {
  if (players.length < 4) return [];

  const matchups = [];
  const n = players.length;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        for (let l = k + 1; l < n; l++) {
          const four = [players[i], players[j], players[k], players[l]];
          matchups.push(
            { teamA: [four[0], four[1]], teamB: [four[2], four[3]] },
            { teamA: [four[0], four[2]], teamB: [four[1], four[3]] },
            { teamA: [four[0], four[3]], teamB: [four[1], four[2]] }
          );
        }
      }
    }
  }

  return matchups;
}

/** Canonical key for a doubles matchup (order-insensitive across teams). */
export function matchKey(m) {
  const t1 = [...m.teamA].sort().join(',');
  const t2 = [...m.teamB].sort().join(',');
  return [t1, t2].sort().join(' vs ');
}

function partnershipKey(p1, p2) {
  return [p1, p2].sort().join('|');
}

/**
 * Update sit-out and partnership tallies as if `m` was just played.
 */
function applyMatchToStats(m, players, sitCount, partnershipCount) {
  const playing = new Set([...m.teamA, ...m.teamB]);
  for (const p of players) {
    if (!playing.has(p)) {
      sitCount.set(p, sitCount.get(p) + 1);
    }
  }
  for (const pair of [m.teamA, m.teamB]) {
    const pk = partnershipKey(pair[0], pair[1]);
    partnershipCount.set(pk, (partnershipCount.get(pk) ?? 0) + 1);
  }
}

/**
 * Schedule matchups in fair order, optionally continuing stats from completed history.
 *
 * @param {Array} matchups - pool to order (e.g. remaining canonical games)
 * @param {string[]} players - roster
 * @param {{ completedHistory?: Array<{ teamA: string[], teamB: string[] }> }} options
 */
export function scheduleFairRotation(matchups, players, options = {}) {
  if (matchups.length === 0) return [];

  const remaining = new Map();
  for (const m of matchups) {
    remaining.set(matchKey(m), m);
  }

  const sitCount = new Map(players.map((p) => [p, 0]));
  const partnershipCount = new Map();
  let rrIndex = 0;

  const history = options.completedHistory ?? [];
  for (const m of history) {
    if (!m?.teamA?.length || !m?.teamB?.length) continue;
    applyMatchToStats(m, players, sitCount, partnershipCount);
    rrIndex++;
  }

  const schedule = [];

  while (remaining.size > 0) {
    let bestMatch = null;
    let bestKey = null;
    let bestScore = -Infinity;

    for (const [key, m] of remaining) {
      const playing = new Set([...m.teamA, ...m.teamB]);
      const sitters = players.filter((p) => !playing.has(p));

      let maxSit = 0;
      let minSit = Infinity;
      for (const p of players) {
        const c = sitCount.get(p) + (sitters.includes(p) ? 1 : 0);
        if (c > maxSit) maxSit = c;
        if (c < minSit) minSit = c;
      }
      const sitDiff = maxSit - minSit;

      let sitPriority = 0;
      for (const p of sitters) {
        sitPriority += sitCount.get(p);
      }

      let rrBonus = 0;
      for (const p of sitters) {
        const idx = players.indexOf(p);
        if (idx === rrIndex % players.length) rrBonus += 1;
      }

      let newPairs = 0;
      for (const pair of [m.teamA, m.teamB]) {
        const pk = partnershipKey(pair[0], pair[1]);
        if (!partnershipCount.get(pk)) newPairs++;
      }

      const score =
        -sitDiff * 10000 +
        -sitPriority * 100 +
        rrBonus * 10 +
        newPairs;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = m;
        bestKey = key;
      }
    }

    schedule.push({ teamA: [...bestMatch.teamA], teamB: [...bestMatch.teamB] });
    remaining.delete(bestKey);

    applyMatchToStats(bestMatch, players, sitCount, partnershipCount);
    rrIndex++;
  }

  return schedule;
}
