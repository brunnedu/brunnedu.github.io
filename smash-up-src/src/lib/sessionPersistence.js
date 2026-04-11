/** Persist session + UI for same-tab refresh; cold open stays fresh with optional resume. */

export const STORAGE_SESSION = 'smashup:session';
export const STORAGE_UI = 'smashup:ui';
export const SESSION_TAB = 'smashup:active-tab';

/** v2: completed history + optional draft; no pre-baked future schedule. */
export const SESSION_SCHEMA_VERSION = 2;
export const UI_SCHEMA_VERSION = 1;

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
    if (p.version !== SESSION_SCHEMA_VERSION) return null;
    if (!Array.isArray(p.players) || !Array.isArray(p.completed)) return null;
    return {
      players: p.players,
      bestOf: !!p.bestOf,
      completed: p.completed,
      draftMatch:
        p.draftMatch?.teamA && p.draftMatch?.teamB
          ? {
              teamA: [...p.draftMatch.teamA],
              teamB: [...p.draftMatch.teamB],
            }
          : null,
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
    if (p.version !== UI_SCHEMA_VERSION) return null;
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
  return !!(s && s.players.length >= 4 && s.date);
}

export function persistSessionState(state) {
  if (!state.players?.length || state.players.length < 4) {
    localStorage.removeItem(STORAGE_SESSION);
    return;
  }
  localStorage.setItem(
    STORAGE_SESSION,
    JSON.stringify({
      version: SESSION_SCHEMA_VERSION,
      players: state.players,
      bestOf: state.bestOf,
      completed: state.completed,
      draftMatch: state.draftMatch,
      date: state.date,
    })
  );
}

export function persistUiState({ screen, players, bestOf }) {
  localStorage.setItem(
    STORAGE_UI,
    JSON.stringify({
      version: UI_SCHEMA_VERSION,
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
