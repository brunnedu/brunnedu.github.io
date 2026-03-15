// Plotly chart style parameters
export const PLOTLY_TITLE_SIZE = 20;
export const PLOTLY_TICK_FONT_SIZE = 14;
export const PLOTLY_LEFT_MARGIN = 80;

export const PARTICIPANT_COLORS = [
  '#2a6ebb',
  '#00b894',
  '#0984e3',
  '#00cec9',
  '#6c5ce7',
  '#fdcb6e',
  '#e17055',
  '#636e72',
];

export function showMainSections() {
  document.getElementById('summary')?.classList.remove('hidden-on-load');
  document.getElementById('participant-summary-section')?.classList.remove('hidden-on-load');
  document.getElementById('visualizations')?.classList.remove('hidden-on-load');
}

export function showVizError(containerId, err) {
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = '';
    container.textContent =
      'Error rendering chart: ' + (err && err.message ? err.message : 'Unknown error.');
    container.style.color = '#ff6b6b';
    container.style.fontWeight = 'bold';
  }
}

export function formatDuration(ms) {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (day > 0) return `${day}d ${hr % 24}h`;
  if (hr > 0) return `${hr}h ${min % 60}m`;
  if (min > 0) return `${min}m ${sec % 60}s`;
  return `${sec}s`;
}

export function formatDateTimeNoSeconds(dateStr) {
  const d = new Date(dateStr);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

export function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

/**
 * Get min and max dates from message timestamps.
 */
export function getTimeRangeFromMessages(messages) {
  if (!messages.length) return { minDate: null, maxDate: null };
  const dates = messages.map((m) => new Date(m.timestamp));
  return {
    minDate: new Date(Math.min(...dates)),
    maxDate: new Date(Math.max(...dates)),
  };
}

/**
 * Generate monthly bucket dates (1st of each month) from min to max, inclusive.
 * Returns array of Date objects for use with Plotly type: 'date'.
 */
export function generateMonthlyBuckets(minDate, maxDate) {
  const buckets = [];
  const current = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  const end = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
  while (current <= end) {
    buckets.push(new Date(current));
    current.setMonth(current.getMonth() + 1);
  }
  return buckets;
}

/**
 * Get YYYY-MM key for a date (for aggregation).
 */
export function getMonthKey(date) {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Aggregate message counts by monthly buckets.
 * @param {Array} messages - Parsed messages
 * @param {Array<Date>} bucketDates - From generateMonthlyBuckets
 * @param {{ byParticipant?: boolean }} opts
 * @returns {{ counts: number[], byUser?: Record<string, number[]> }}
 */
export function aggregateMessagesByMonth(messages, bucketDates, { byParticipant = false } = {}) {
  const bucketKeys = bucketDates.map((d) => getMonthKey(d));
  const keyToIndex = Object.fromEntries(bucketKeys.map((k, i) => [k, i]));
  const counts = bucketKeys.map(() => 0);
  const byUser = byParticipant ? {} : null;

  messages.forEach((m) => {
    if (!m.user && byParticipant) return;
    const key = getMonthKey(m.timestamp);
    const idx = keyToIndex[key];
    if (idx === undefined) return;
    counts[idx]++;
    if (byParticipant) {
      if (!byUser[m.user]) byUser[m.user] = bucketKeys.map(() => 0);
      byUser[m.user][idx]++;
    }
  });

  return byParticipant ? { counts, byUser } : { counts };
}
