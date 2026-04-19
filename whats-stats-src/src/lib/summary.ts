import { formatDuration } from './utils';
import { countWordOccurrences, countEmojiOccurrences, getTopTfidfWordsPerParticipant } from './analysis';
import type { ChatMessage, ParticipantStat } from './types';

export type SummaryCard = { label: string; value: string };

export function getSummaryCards(messages: ChatMessage[]): SummaryCard[] {
  const totalMessages = messages.length;
  const participants = Array.from(
    new Set(messages.map((m) => m.user).filter((user): user is string => user !== null))
  );
  const dates = messages.map((m) => new Date(m.timestamp));
  const firstDate = new Date(Math.min(...dates.map((d) => d.getTime())));
  const lastDate = new Date(Math.max(...dates.map((d) => d.getTime())));
  const totalChars = messages.reduce((sum, m) => sum + m.message.length, 0);
  const dayCounts: Record<string, number> = {};
  messages.forEach((m) => {
    const day = m.timestamp.slice(0, 10);
    dayCounts[day] = (dayCounts[day] || 0) + 1;
  });
  const avgPerDay = (totalMessages / Object.keys(dayCounts).length).toFixed(2);
  const mostActiveDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0];
  const hourCounts: Record<number, number> = {};
  messages.forEach((m) => {
    const hour = new Date(m.timestamp).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });
  const mostActiveHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];

  return [
    { label: 'Total Messages', value: String(totalMessages) },
    { label: 'Participants', value: String(participants.length) },
    {
      label: 'Date Range',
      value: `${firstDate.toLocaleDateString()} – ${lastDate.toLocaleDateString()}`,
    },
    { label: 'Total Characters', value: String(totalChars) },
    { label: 'Avg. Messages/Day', value: avgPerDay },
    {
      label: 'Most Active Day',
      value: mostActiveDay ? `${mostActiveDay[0]} (${mostActiveDay[1]})` : '—',
    },
    {
      label: 'Most Active Hour',
      value: mostActiveHour ? `${mostActiveHour[0]}:00 (${mostActiveHour[1]})` : '—',
    },
  ];
}

export function buildParticipantStats(messages: ChatMessage[]): ParticipantStat[] {
  const participants = Array.from(
    new Set(messages.map((m) => m.user).filter((user): user is string => user !== null))
  );
  const wordCountsByUser = countWordOccurrences(messages, {
    byParticipant: true,
    ngram: 1,
    skipEmojis: true,
  }) as Record<string, Record<string, number>>;
  const emojiCountsByUser = countEmojiOccurrences(messages, {
    byParticipant: true,
  }) as Record<string, Record<string, number>>;
  const uniqueWordsByUser = getTopTfidfWordsPerParticipant(messages, { topN: 5, skipEmojis: true });

  const participantStats: ParticipantStat[] = participants.map((user) => {
    const userMsgs = messages.filter((m) => m.user === user);
    const numMessages = userMsgs.length;
    const avgMsgLen =
      numMessages > 0
        ? (userMsgs.reduce((sum, m) => sum + m.message.length, 0) / numMessages).toFixed(1)
        : '0';
    const emojiCounts = emojiCountsByUser[user] || {};
    const topEmojis = Object.entries(emojiCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([emoji]) => emoji);
    let longestMsgText = '';
    let longestMsgLen = 0;
    userMsgs.forEach((m) => {
      if (m.message.length > longestMsgLen) {
        longestMsgLen = m.message.length;
        longestMsgText = m.message;
      }
    });
    const wordCounts = wordCountsByUser[user] || {};
    const nUniqueWords = Object.keys(wordCounts).length;
    const topWords = Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word, count]) => ({ word, count }));
    const topUniqueWords = uniqueWordsByUser[user] || [];
    let longestGap = 0;
    let gapStart: Date | null = null;
    let gapEnd: Date | null = null;
    let lastMsgTime: Date | null = null;
    if (userMsgs.length > 0) {
      const sortedMsgs = userMsgs
        .slice()
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
      lastMsgTime = new Date(sortedMsgs[sortedMsgs.length - 1].timestamp);
      for (let i = 1; i < sortedMsgs.length; i++) {
        const prev = new Date(sortedMsgs[i - 1].timestamp);
        const curr = new Date(sortedMsgs[i].timestamp);
        const gap = curr.getTime() - prev.getTime();
        if (gap > longestGap) {
          longestGap = gap;
          gapStart = prev;
          gapEnd = curr;
        }
      }
      const mostRecentMsg = messages.reduce((a, b) =>
        new Date(a.timestamp) > new Date(b.timestamp) ? a : b
      );
      const gapToNow = new Date(mostRecentMsg.timestamp).getTime() - lastMsgTime.getTime();
      if (gapToNow > longestGap) {
        longestGap = gapToNow;
        gapStart = lastMsgTime;
        gapEnd = new Date(mostRecentMsg.timestamp);
      }
    }
    return {
      user,
      numMessages,
      avgMsgLen,
      longestMsgLen,
      longestMsgText,
      nUniqueWords,
      topEmojis,
      emojiCounts,
      topWords,
      topUniqueWords,
      longestGap,
      gapStart,
      gapEnd,
      lastMsgTime,
    };
  });
  participantStats.sort((a, b) => b.numMessages - a.numMessages);
  return participantStats;
}

export function gapTitle(stat: ParticipantStat): string {
  if (stat.gapStart && stat.gapEnd) {
    return `${stat.gapStart.toLocaleString()} → ${stat.gapEnd.toLocaleString()}`;
  }
  return '';
}
