import type { ChatMessage } from './types';

/** Adaptive response window (T) and episode gap (G) from this chat’s inter-message gaps. */
export type AdaptiveChatTiming = {
  responseWindowMs: number;
  episodeGapMs: number;
  /** Count of gaps used for T (speaker changed) */
  nSpeakerChangeGaps: number;
  /** Count of consecutive message gaps (chronological) */
  nAllGaps: number;
};

const MS = 1000;
const MIN_MESSAGES = 2;

/** p80 of speaker-change gaps, clamped; used as “same exchange” response window. */
const T_QUANTILE = 0.8;
const T_FLOOR_MS = 30 * MS;
/** Upper bound for T only guards absurd multi-day “same reply window” values; keep high so p80 usually applies. */
const T_CEIL_MS = 24 * 60 * 60 * MS;

/** p97 of all gaps, clamped; used to split long silent breaks between episodes. */
const G_QUANTILE = 0.97;
const G_FLOOR_MS = 10 * 60 * MS;
/** Long chats often have p97 gaps of many days; allow that through instead of pinning to 24h. */
const G_CEIL_MS = 30 * 24 * 60 * 60 * MS;

/** Ensure episode gap is meaningfully larger than response window. */
const G_MIN_MULTIPLE_OF_T = 6;

const DEFAULT_T_MS = 5 * 60 * MS;
const DEFAULT_G_MS = 45 * 60 * MS;

function quantileSorted(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return NaN;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const pos = p * (sortedAsc.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sortedAsc[lo];
  const t = pos - lo;
  return sortedAsc[lo] * (1 - t) + sortedAsc[hi] * t;
}

function sortedChronological(messages: ChatMessage[]): ChatMessage[] {
  return messages.slice().sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

function interMessageGapsMs(sorted: ChatMessage[]): { all: number[]; speakerChange: number[] } {
  const all: number[] = [];
  const speakerChange: number[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const dt = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    if (!Number.isFinite(dt) || dt < 0) continue;
    all.push(dt);
    const ua = a.user;
    const ub = b.user;
    if (ua && ub && ua !== ub) speakerChange.push(dt);
  }
  return { all, speakerChange };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Derives T (response window) and G (episode break) from gap quantiles for this chat.
 * T: p80 of gaps where a different participant speaks next (else p80 of all gaps).
 * G: p97 of all gaps, clamped, then at least 6×T (capped by G_CEIL).
 */
export function computeAdaptiveChatTiming(messages: ChatMessage[]): AdaptiveChatTiming {
  if (messages.length < MIN_MESSAGES) {
    return {
      responseWindowMs: DEFAULT_T_MS,
      episodeGapMs: DEFAULT_G_MS,
      nSpeakerChangeGaps: 0,
      nAllGaps: 0,
    };
  }

  const sorted = sortedChronological(messages);
  const { all, speakerChange } = interMessageGapsMs(sorted);

  const gapsForT = speakerChange.length >= 3 ? speakerChange : all.length >= 3 ? all : [];
  const sortedT = gapsForT.length ? [...gapsForT].sort((x, y) => x - y) : [];
  const tRaw = sortedT.length ? quantileSorted(sortedT, T_QUANTILE) : DEFAULT_T_MS;
  let responseWindowMs = clamp(Number.isFinite(tRaw) ? tRaw : DEFAULT_T_MS, T_FLOOR_MS, T_CEIL_MS);

  const sortedAll = all.length ? [...all].sort((x, y) => x - y) : [];
  const gRaw = sortedAll.length ? quantileSorted(sortedAll, G_QUANTILE) : DEFAULT_G_MS;
  let episodeGapMs = clamp(Number.isFinite(gRaw) ? gRaw : DEFAULT_G_MS, G_FLOOR_MS, G_CEIL_MS);

  const minG = responseWindowMs * G_MIN_MULTIPLE_OF_T;
  if (episodeGapMs < minG) {
    episodeGapMs = clamp(minG, G_FLOOR_MS, G_CEIL_MS);
  }

  return {
    responseWindowMs,
    episodeGapMs,
    nSpeakerChangeGaps: speakerChange.length,
    nAllGaps: all.length,
  };
}
