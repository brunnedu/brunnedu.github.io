import type { ChatMessage } from './types';
import type { AdaptiveChatTiming } from './chatTiming';
import { computeAdaptiveChatTiming } from './chatTiming';
import { getParticipantsSortedByMessageCount } from './analysis';

/** Minimum messages from a person to include them as a **column** (first responder within T). */
export const MIN_MESSAGES_FROM_SOURCE = 5;

/** Minimum total “first reply” captures where this person was the responder (column sum). */
export const MIN_COLUMN_FOLLOW_EVENTS = 3;

/** Mentioned in UI: edges (cells) with fewer than this many raw follow events are low-signal. */
export const MIN_EDGE_FOLLOW_EVENTS = 2;

function sortChronological(messages: ChatMessage[]): ChatMessage[] {
  return messages.slice().sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
}

/** Split sorted messages into episodes when the gap before the next message exceeds G. */
function splitEpisodes(sorted: ChatMessage[], gapMs: number): ChatMessage[][] {
  if (sorted.length === 0) return [];
  const out: ChatMessage[][] = [];
  let cur: ChatMessage[] = [sorted[0]!];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const m = sorted[i]!;
    const dt = new Date(m.timestamp).getTime() - new Date(prev.timestamp).getTime();
    if (Number.isFinite(dt) && dt > gapMs) {
      out.push(cur);
      cur = [m];
    } else {
      cur.push(m);
    }
  }
  out.push(cur);
  return out;
}

/**
 * For each message from A, find the first message from B≠A within the same episode whose
 * timestamp is ≤ T after A. Counts one edge A→B per qualifying A-message.
 */
function accumulateFollowCounts(
  episodes: ChatMessage[][],
  participants: string[],
  Tms: number
): number[][] {
  const idx = Object.fromEntries(participants.map((p, i) => [p, i]));
  const n = participants.length;
  const raw = Array.from({ length: n }, () => Array(n).fill(0));

  for (const ep of episodes) {
    for (let i = 0; i < ep.length; i++) {
      const msg = ep[i]!;
      const a = msg.user;
      if (!a || !(a in idx)) continue;
      const t0 = new Date(msg.timestamp).getTime();
      const ia = idx[a]!;
      for (let j = i + 1; j < ep.length; j++) {
        const next = ep[j]!;
        const tj = new Date(next.timestamp).getTime();
        if (!Number.isFinite(tj) || tj - t0 > Tms) break;
        const b = next.user;
        if (b && b !== a && b in idx) {
          raw[ia]![idx[b]!]! += 1;
          break;
        }
      }
    }
  }
  return raw;
}

export type FollowMatrixResult = {
  participants: string[];
  raw: number[][];
  /** Column-normalized: z[i][j] = raw[i][j] / sum_i raw[i][j]; null if column excluded or diagonal. */
  z: (number | null)[][];
  /** Sum of raw[i][j] over i (times j was first responder after someone). */
  colSums: number[];
  /** Which columns (responders) are included */
  colIncluded: boolean[];
  timing: AdaptiveChatTiming;
  totalMessagesByUser: Record<string, number>;
};

export function computeFollowMatrix(messages: ChatMessage[]): FollowMatrixResult | null {
  const { participants, totalMessagesByUser } = getParticipantsSortedByMessageCount(messages);
  if (participants.length < 2) return null;

  const timing = computeAdaptiveChatTiming(messages);
  const sorted = sortChronological(messages);
  const episodes = splitEpisodes(sorted, timing.episodeGapMs);
  const raw = accumulateFollowCounts(episodes, participants, timing.responseWindowMs);

  const n = participants.length;
  const colSums = new Array(n).fill(0);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      if (i !== j) colSums[j] += raw[i]![j]!;
    }
  }

  const z: (number | null)[][] = Array.from({ length: n }, () => Array(n).fill(null));
  const colIncluded: boolean[] = [];

  for (let j = 0; j < n; j++) {
    const user = participants[j]!;
    const msgCount = totalMessagesByUser[user] ?? 0;
    const colSum = colSums[j]!;
    const include = msgCount >= MIN_MESSAGES_FROM_SOURCE && colSum >= MIN_COLUMN_FOLLOW_EVENTS;
    colIncluded.push(include);
    if (!include) continue;
    for (let i = 0; i < n; i++) {
      if (i === j) {
        z[i]![j] = null;
        continue;
      }
      z[i]![j] = colSum > 0 ? raw[i]![j]! / colSum : null;
    }
  }

  return { participants, raw, z, colSums, colIncluded, timing, totalMessagesByUser };
}
