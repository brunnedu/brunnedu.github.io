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

function dedupeMatchups(matchups) {
  const seen = new Set();
  const result = [];
  for (const m of matchups) {
    const key = matchKey(m);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(m);
    }
  }
  return result;
}

function matchKey(m) {
  const t1 = [...m.teamA].sort().join(',');
  const t2 = [...m.teamB].sort().join(',');
  return [t1, t2].sort().join(' vs ');
}

/**
 * Schedule matchups with fair rotation: balanced play counts, partnership diversity,
 * minimal consecutive sit-outs.
 */
export function scheduleFairRotation(matchups, players) {
  if (matchups.length === 0) return [];

  const schedule = [];
  let remaining = matchups.map((m) => ({ ...m, key: matchKey(m) }));
  const playCount = new Map(players.map((p) => [p, 0]));
  const partnershipCount = new Map();
  const consecutiveSitouts = new Map(players.map((p) => [p, 0]));

  function getPartnershipKey(p1, p2) {
    return [p1, p2].sort().join('|');
  }

  function scoreMatch(m) {
    const playing = [...m.teamA, ...m.teamB];
    const sitting = players.filter((p) => !playing.includes(p));

    const maxPlayed = Math.max(...playCount.values(), 0);
    let playPriority = 0;
    for (const p of playing) {
      playPriority += maxPlayed - (playCount.get(p) ?? 0);
    }

    let partnershipPriority = 0;
    for (const pair of [m.teamA, m.teamB]) {
      const key = getPartnershipKey(pair[0], pair[1]);
      const count = partnershipCount.get(key) ?? 0;
      partnershipPriority += count === 0 ? 10 : 0;
    }

    let sitoutPenalty = 0;
    for (const p of sitting) {
      sitoutPenalty += (consecutiveSitouts.get(p) ?? 0) * 5;
    }

    return playPriority * 2 + partnershipPriority - sitoutPenalty;
  }

  function applyMatch(m) {
    const playing = [...m.teamA, ...m.teamB];
    const sitting = players.filter((p) => !playing.includes(p));

    for (const p of playing) {
      playCount.set(p, (playCount.get(p) ?? 0) + 1);
      consecutiveSitouts.set(p, 0);
    }
    for (const p of sitting) {
      consecutiveSitouts.set(p, (consecutiveSitouts.get(p) ?? 0) + 1);
    }
    for (const pair of [m.teamA, m.teamB]) {
      const key = getPartnershipKey(pair[0], pair[1]);
      partnershipCount.set(key, (partnershipCount.get(key) ?? 0) + 1);
    }
  }

  while (remaining.length > 0) {
    let best = remaining[0];
    let bestScore = scoreMatch(best);
    const ties = [best];

    for (let i = 1; i < remaining.length; i++) {
      const m = remaining[i];
      const s = scoreMatch(m);
      if (s > bestScore) {
        best = m;
        bestScore = s;
        ties.length = 0;
        ties.push(m);
      } else if (s === bestScore) {
        ties.push(m);
      }
    }

    const picked = ties.length === 1 ? ties[0] : ties[Math.floor(Math.random() * ties.length)];
    schedule.push({ teamA: picked.teamA, teamB: picked.teamB });
    applyMatch(picked);
    remaining = remaining.filter((m) => m.key !== picked.key);
  }

  return schedule;
}
