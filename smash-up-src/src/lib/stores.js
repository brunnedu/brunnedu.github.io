import { get, writable } from 'svelte/store';
import {
  clearAllPersisted,
  persistSessionState,
} from './sessionPersistence.js';
import {
  generateAllMatchups,
  matchKey,
  scheduleFairRotation,
} from './scheduler.js';

const initialState = {
  players: [],
  bestOf: false,
  completed: [],
  draftMatch: null,
  suggestedSchedule: [],
  date: '',
};

export const sessionStore = writable(initialState);

export { matchKey };

/**
 * Derive suggestion "round" (Option B: new pass when all canonical pairings
 * were consumed once this pass) and which keys are already played this pass.
 * Repeats of the same matchup in the same pass do not consume a new slot.
 */
export function deriveRoundState(players, completed) {
  const all = generateAllMatchups(players);
  const C = all.length;
  if (C === 0) return { suggestionRound: 1, playedKeysThisPass: [] };

  const canonicalKeys = new Set(all.map(matchKey));
  let suggestionRound = 1;
  const pass = new Set();

  for (const m of completed) {
    const k = matchKey(m);
    if (!canonicalKeys.has(k)) continue;
    if (pass.has(k)) continue;
    pass.add(k);
    if (pass.size >= C) {
      suggestionRound++;
      pass.clear();
    }
  }

  return { suggestionRound, playedKeysThisPass: [...pass] };
}

/** Ordered suggestions for upcoming games (pool = canonical minus this pass). */
export function buildSuggestedSchedule(state) {
  const { players, completed } = state;
  if (!players?.length || players.length < 4) return [];

  const { playedKeysThisPass } = deriveRoundState(players, completed);
  const played = new Set(playedKeysThisPass);
  const all = generateAllMatchups(players);
  const remaining = all.filter((m) => !played.has(matchKey(m)));
  if (remaining.length === 0) return [];

  return scheduleFairRotation(remaining, players, {
    completedHistory: completed,
  });
}

/** Pairing for the live game: manual draft, else first suggestion. */
export function getActiveMatchPairing(s) {
  if (s.draftMatch?.teamA?.length === 2 && s.draftMatch?.teamB?.length === 2) {
    return {
      teamA: [...s.draftMatch.teamA],
      teamB: [...s.draftMatch.teamB],
    };
  }
  const first = s.suggestedSchedule?.[0];
  if (first?.teamA?.length && first?.teamB?.length) {
    return { teamA: [...first.teamA], teamB: [...first.teamB] };
  }
  return null;
}

/** Up to 3 suggested games after the active pairing. */
export function getSuggestedNextThree(s) {
  const active = getActiveMatchPairing(s);
  const list = s.suggestedSchedule ?? [];
  if (!active) return list.slice(0, 3);
  const ak = matchKey(active);
  return list.filter((m) => matchKey(m) !== ak).slice(0, 3);
}

export function initSession(players, bestOf) {
  const p = [...players];
  const base = {
    players: p,
    bestOf,
    completed: [],
    draftMatch: null,
    date: new Date().toISOString().slice(0, 10),
  };
  const suggestedSchedule = buildSuggestedSchedule(base);
  const state = { ...base, suggestedSchedule };
  sessionStore.set(state);
  persistSessionState(get(sessionStore));
}

function persist() {
  persistSessionState(get(sessionStore));
}

export function applyCurrentSlots(slotPlayers) {
  const [a, b, c, d] = slotPlayers;
  sessionStore.update((s) => {
    if (!a || !b || !c || !d || new Set([a, b, c, d]).size !== 4) {
      return { ...s, draftMatch: null };
    }
    const custom = { teamA: [a, b], teamB: [c, d] };
    const first = s.suggestedSchedule?.[0];
    const draftMatch =
      first && matchKey(custom) === matchKey(first) ? null : custom;
    return { ...s, draftMatch };
  });
  persist();
}

/** Append current pairing to history; assigns game = previous length + 1. */
export function saveCurrentMatchResult(sets, winner) {
  sessionStore.update((s) => {
    const active = getActiveMatchPairing(s);
    if (!active) return s;
    const game = s.completed.length + 1;
    const row = {
      game,
      teamA: [...active.teamA],
      teamB: [...active.teamB],
      sets,
      winner,
    };
    const completed = [...s.completed, row];
    const draftMatch = null;
    const suggestedSchedule = buildSuggestedSchedule({
      ...s,
      completed,
      draftMatch,
    });
    return { ...s, completed, draftMatch, suggestedSchedule };
  });
  persist();
}

export function updateCompletedMatchScore(game, sets, winner) {
  sessionStore.update((s) => {
    const completed = s.completed.map((m) =>
      m.game === game ? { ...m, sets, winner } : m
    );
    const suggestedSchedule = buildSuggestedSchedule({ ...s, completed });
    return { ...s, completed, suggestedSchedule };
  });
  persist();
}

export function resetSession() {
  clearAllPersisted();
  sessionStore.set(initialState);
}

/** After load from disk: rebuild suggestedSchedule from completed + roster. */
export function normalizeSessionState(s) {
  const completed = (s.completed ?? []).map((m) => ({
    game: m.game,
    teamA: [...m.teamA],
    teamB: [...m.teamB],
    sets: m.sets?.map((st) => ({ scoreA: st.scoreA, scoreB: st.scoreB })),
    winner: m.winner,
  }));
  const base = {
    players: [...(s.players ?? [])],
    bestOf: !!s.bestOf,
    completed,
    draftMatch:
      s.draftMatch?.teamA?.length === 2 && s.draftMatch?.teamB?.length === 2
        ? {
            teamA: [...s.draftMatch.teamA],
            teamB: [...s.draftMatch.teamB],
          }
        : null,
    date: typeof s.date === 'string' ? s.date : '',
  };
  return {
    ...base,
    suggestedSchedule: buildSuggestedSchedule(base),
  };
}
