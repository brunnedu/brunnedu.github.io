import { get, writable } from 'svelte/store';
import {
  clearAllPersisted,
  persistSessionState,
} from './sessionPersistence.js';

const initialState = {
  players: [],
  bestOf: false,
  matches: [],
  date: '',
};

export const sessionStore = writable(initialState);

export function initSession(players, bestOf, scheduledMatches) {
  const state = {
    players: [...players],
    bestOf,
    matches: scheduledMatches.map((m, i) => ({
      game: i + 1,
      teamA: [...m.teamA],
      teamB: [...m.teamB],
    })),
    date: new Date().toISOString().slice(0, 10),
  };
  sessionStore.set(state);
  persistSessionState(state);
}

export function setMatchScore(gameIndex, sets, winner) {
  sessionStore.update((s) => {
    const matches = [...s.matches];
    const idx = matches.findIndex((m) => m.game === gameIndex);
    if (idx === -1) return s;
    matches[idx] = { ...matches[idx], sets, winner };
    return { ...s, matches };
  });
  persistSessionState(get(sessionStore));
}

export function resetSession() {
  clearAllPersisted();
  sessionStore.set(initialState);
}
