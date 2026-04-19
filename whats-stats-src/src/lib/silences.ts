import type { ChatMessage, SilenceRow } from './types';

export function getLongestSilences(messages: ChatMessage[], topN = 5): SilenceRow[] {
  if (!messages || messages.length < 2) return [];
  const silences: SilenceRow[] = [];
  for (let i = 1; i < messages.length; i++) {
    const prev = messages[i - 1];
    const curr = messages[i];
    const gap = new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime();
    silences.push({
      duration: gap,
      start: prev.timestamp,
      end: curr.timestamp,
      breaker: curr.user,
    });
  }
  return silences.sort((a, b) => b.duration - a.duration).slice(0, topN);
}
