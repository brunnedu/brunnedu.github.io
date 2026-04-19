import type { ChatMessage } from './types';

export const PLOTLY_TITLE_SIZE = 20;
export const PLOTLY_TICK_FONT_SIZE = 14;
export const PLOTLY_LEFT_MARGIN = 80;

export function getPlotlyLayoutSizes() {
  const w = typeof window !== 'undefined' ? window.innerWidth : 900;
  const narrow = w < 600;
  return {
    title: narrow ? 16 : PLOTLY_TITLE_SIZE,
    tick: narrow ? 12 : PLOTLY_TICK_FONT_SIZE,
    left: narrow ? 52 : PLOTLY_LEFT_MARGIN,
  };
}

export function getChartHeightPx(variant: 'small' | 'medium' | 'large' = 'medium'): number {
  const land = typeof window !== 'undefined' && window.innerWidth > window.innerHeight;
  const h = typeof window !== 'undefined' ? window.innerHeight : 800;
  const presets = {
    small: { portrait: 0.38, landscape: 0.48, min: 240, max: 380 },
    medium: { portrait: 0.44, landscape: 0.55, min: 280, max: 520 },
    large: { portrait: 0.5, landscape: 0.62, min: 320, max: 720 },
  };
  const p = presets[variant] || presets.medium;
  const frac = land ? p.landscape : p.portrait;
  return Math.round(Math.min(p.max, Math.max(p.min, h * frac)));
}

export function isCoarsePointer(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(pointer: coarse)').matches;
}

export function getPlotlyConfig() {
  return {
    responsive: true,
    scrollZoom: !isCoarsePointer(),
    displayModeBar: true,
  };
}

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

export function showVizError(container: HTMLElement, err: unknown) {
  container.innerHTML = '';
  container.textContent =
    'Error rendering chart: ' +
    (err instanceof Error ? err.message : err ? String(err) : 'Unknown error.');
  container.style.color = '#ff6b6b';
  container.style.fontWeight = 'bold';
}

export function formatDuration(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (day > 0) return `${day}d ${hr % 24}h`;
  if (hr > 0) return `${hr}h ${min % 60}m`;
  if (min > 0) return `${min}m ${sec % 60}s`;
  return `${sec}s`;
}

export function formatDateTimeNoSeconds(dateStr: string): string {
  const d = new Date(dateStr);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mins}`;
}

export function getTimeRangeFromMessages(messages: ChatMessage[]): { minDate: Date | null; maxDate: Date | null } {
  if (!messages.length) return { minDate: null, maxDate: null };
  const dates = messages.map((m) => new Date(m.timestamp));
  return {
    minDate: new Date(Math.min(...dates.map((d) => d.getTime()))),
    maxDate: new Date(Math.max(...dates.map((d) => d.getTime()))),
  };
}

export function generateMonthlyBuckets(minDate: Date, maxDate: Date): Date[] {
  const buckets: Date[] = [];
  const current = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
  const end = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
  while (current <= end) {
    buckets.push(new Date(current));
    current.setMonth(current.getMonth() + 1);
  }
  return buckets;
}

export function getMonthKey(date: string | Date): string {
  const d = date instanceof Date ? date : new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function aggregateMessagesByMonth(
  messages: ChatMessage[],
  bucketDates: Date[],
  { byParticipant = false }: { byParticipant?: boolean } = {}
): { counts: number[]; byUser?: Record<string, number[]> } {
  const bucketKeys = bucketDates.map((d) => getMonthKey(d));
  const keyToIndex = Object.fromEntries(bucketKeys.map((k, i) => [k, i]));
  const counts = bucketKeys.map(() => 0);
  const byUser: Record<string, number[]> | undefined = byParticipant ? {} : undefined;

  messages.forEach((m) => {
    if (!m.user && byParticipant) return;
    const key = getMonthKey(m.timestamp);
    const idx = keyToIndex[key];
    if (idx === undefined) return;
    counts[idx]++;
    if (byParticipant && byUser && m.user) {
      if (!byUser[m.user]) byUser[m.user] = bucketKeys.map(() => 0);
      byUser[m.user][idx]++;
    }
  });

  return byParticipant ? { counts, byUser } : { counts };
}
