import type { ChatMessage } from './types';

export function getParticipantsSortedByMessageCount(
  messages: ChatMessage[],
  { order = 'desc' }: { order?: 'desc' | 'asc' } = {}
): { participants: string[]; totalMessagesByUser: Record<string, number> } {
  const participants = Array.from(
    new Set(messages.map((m) => m.user).filter((user): user is string => user !== null))
  );
  const totalMessagesByUser: Record<string, number> = {};
  participants.forEach((user) => {
    totalMessagesByUser[user] = 0;
  });
  messages.forEach((m) => {
    if (m.user) totalMessagesByUser[m.user] = (totalMessagesByUser[m.user] || 0) + 1;
  });
  const sorted = participants.sort(
    (a, b) => (order === 'asc' ? 1 : -1) * (totalMessagesByUser[b] - totalMessagesByUser[a])
  );
  return { participants: sorted, totalMessagesByUser };
}

export function countWordOccurrences(
  messages: ChatMessage[],
  {
    byParticipant = false,
    ngram = 1,
    skipEmojis = false,
  }: { byParticipant?: boolean; ngram?: number; skipEmojis?: boolean } = {}
): Record<string, number> | Record<string, Record<string, number>> {
  const cleanPhrases = [
    /<Media omitted>/gi,
    /<This message was edited>/gi,
    /This message was deleted/gi,
    /live location shared/gi,
  ];
  const emojiRegex = /\p{Extended_Pictographic}/gu;

  function getWords(msg: string): string[] {
    let cleaned = msg;
    cleanPhrases.forEach((re) => {
      cleaned = cleaned.replace(re, '');
    });
    let words = cleaned
      .split(/\s+/)
      .map((word) => word.toLowerCase().replace(/[^\p{L}\p{N}'-]/gu, ''))
      .filter(Boolean);
    if (skipEmojis) {
      words = words.filter((w) => !emojiRegex.test(w));
    }
    return words;
  }

  if (byParticipant) {
    const counts: Record<string, Record<string, number>> = {};
    messages.forEach((m) => {
      if (!m.user) return;
      if (!counts[m.user]) counts[m.user] = {};
      const words = getWords(m.message);
      for (let i = 0; i <= words.length - ngram; i++) {
        const gram = words.slice(i, i + ngram).join(' ');
        if (gram) counts[m.user][gram] = (counts[m.user][gram] || 0) + 1;
      }
    });
    return counts;
  }
  const counts: Record<string, number> = {};
  messages.forEach((m) => {
    if (!m.user) return;
    const words = getWords(m.message);
    for (let i = 0; i <= words.length - ngram; i++) {
      const gram = words.slice(i, i + ngram).join(' ');
      if (gram) counts[gram] = (counts[gram] || 0) + 1;
    }
  });
  return counts;
}

export function countEmojiOccurrences(
  messages: ChatMessage[],
  { byParticipant = false }: { byParticipant?: boolean } = {}
): Record<string, number> | Record<string, Record<string, number>> {
  const emojiRegex = /\p{Extended_Pictographic}/gu;
  const genderSigns = ['\u2640', '\u2642', '\u2640\uFE0F', '\u2642\uFE0F', '♀', '♂', '♀️', '♂️'];

  if (byParticipant) {
    const counts: Record<string, Record<string, number>> = {};
    messages.forEach((m) => {
      if (!m.user) return;
      if (!counts[m.user]) counts[m.user] = {};
      const emojis = Array.from(m.message.matchAll(emojiRegex), (x) => x[0]);
      for (let i = 0; i < emojis.length; i++) {
        if (genderSigns.includes(emojis[i])) continue;
        counts[m.user][emojis[i]] = (counts[m.user][emojis[i]] || 0) + 1;
      }
    });
    return counts;
  }
  const counts: Record<string, number> = {};
  messages.forEach((m) => {
    const emojis = Array.from(m.message.matchAll(emojiRegex), (x) => x[0]);
    for (let i = 0; i < emojis.length; i++) {
      if (genderSigns.includes(emojis[i])) continue;
      counts[emojis[i]] = (counts[emojis[i]] || 0) + 1;
    }
  });
  return counts;
}

export function getTopTfidfWordsPerParticipant(
  messages: ChatMessage[],
  { topN = 10, skipEmojis = true }: { topN?: number; skipEmojis?: boolean } = {}
): Record<string, { word: string; score: number; count: number }[]> {
  const userWordCounts = countWordOccurrences(messages, {
    byParticipant: true,
    skipEmojis,
  }) as Record<string, Record<string, number>>;

  const documentFrequency: Record<string, number> = {};
  const users = Object.keys(userWordCounts);

  users.forEach((user) => {
    const wordSet = new Set(Object.keys(userWordCounts[user]));
    wordSet.forEach((word) => {
      documentFrequency[word] = (documentFrequency[word] || 0) + 1;
    });
  });

  const numUsers = users.length;
  const tfidfPerUser: Record<string, { word: string; score: number; count: number }[]> = {};

  users.forEach((user) => {
    const wordCounts = userWordCounts[user];
    const tfidfList: { word: string; score: number; count: number }[] = [];

    for (const word in wordCounts) {
      const tf = wordCounts[word];
      const df = documentFrequency[word];
      const idf = Math.log(numUsers / df);
      const score = tf * idf;

      tfidfList.push({
        word,
        score,
        count: tf,
      });
    }

    tfidfList.sort((a, b) => b.score - a.score);
    tfidfPerUser[user] = tfidfList.slice(0, topN);
  });

  return tfidfPerUser;
}
