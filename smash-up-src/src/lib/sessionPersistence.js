/** Persist session + UI for same-tab refresh; cold open stays fresh with optional resume. */

export const STORAGE_SESSION = 'smashup:session';
export const STORAGE_UI = 'smashup:ui';
export const SESSION_TAB = 'smashup:active-tab';
export const SCHEMA_VERSION = 1;

/**
 * Same document navigation (reload) keeps sessionStorage; closing tab / PWA clears it.
 */
export function getBootstrapHydration() {
  const sameTab = sessionStorage.getItem(SESSION_TAB) === '1';
  if (!sameTab) {
    sessionStorage.setItem(SESSION_TAB, '1');
  }
  if (sameTab) {
    return {
      mode: 'same-tab',
      session: readSavedSession(),
      ui: readSavedUi(),
    };
  }
  return { mode: 'cold', session: null, ui: null };
}

export function readSavedSession() {
  try {
    const raw = localStorage.getItem(STORAGE_SESSION);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p.version !== SCHEMA_VERSION || !Array.isArray(p.matches)) return null;
    return {
      players: Array.isArray(p.players) ? p.players : [],
      bestOf: !!p.bestOf,
      matches: p.matches,
      date: typeof p.date === 'string' ? p.date : '',
    };
  } catch {
    return null;
  }
}

export function readSavedUi() {
  try {
    const raw = localStorage.getItem(STORAGE_UI);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p.version !== SCHEMA_VERSION) return null;
    return {
      screen: p.screen === 'session' ? 'session' : 'setup',
      players: Array.isArray(p.players) ? p.players : [],
      bestOf: !!p.bestOf,
    };
  } catch {
    return null;
  }
}

export function hasSavedSession() {
  const s = readSavedSession();
  return !!(s && s.matches.length > 0);
}

export function persistSessionState(state) {
  if (!state.matches?.length) {
    localStorage.removeItem(STORAGE_SESSION);
    return;
  }
  localStorage.setItem(
    STORAGE_SESSION,
    JSON.stringify({
      version: SCHEMA_VERSION,
      players: state.players,
      bestOf: state.bestOf,
      matches: state.matches,
      date: state.date,
    })
  );
}

export function persistUiState({ screen, players, bestOf }) {
  localStorage.setItem(
    STORAGE_UI,
    JSON.stringify({
      version: SCHEMA_VERSION,
      screen,
      players: [...players],
      bestOf,
    })
  );
}

export function clearAllPersisted() {
  localStorage.removeItem(STORAGE_SESSION);
  localStorage.removeItem(STORAGE_UI);
}

/** Deep clone saved session into a store-safe snapshot. */
export function cloneSessionForStore(s) {
  if (!s?.matches?.length) return null;
  return {
    players: [...s.players],
    bestOf: !!s.bestOf,
    matches: s.matches.map((m) => ({
      game: m.game,
      teamA: [...m.teamA],
      teamB: [...m.teamB],
      ...(m.sets?.length ? { sets: m.sets.map((st) => ({ scoreA: st.scoreA, scoreB: st.scoreB })) } : {}),
      ...(m.winner ? { winner: m.winner } : {}),
    })),
    date: s.date,
  };
}
