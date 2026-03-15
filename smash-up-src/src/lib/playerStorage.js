const STORAGE_KEY = 'smashup-recent-players';
const MAX_RECENT = 20;

export function getRecentPlayers() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

export function addRecentPlayer(name) {
  const recent = getRecentPlayers();
  const trimmed = name.trim();
  if (!trimmed) return;
  const filtered = recent.filter((n) => n.toLowerCase() !== trimmed.toLowerCase());
  const updated = [trimmed, ...filtered].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}
