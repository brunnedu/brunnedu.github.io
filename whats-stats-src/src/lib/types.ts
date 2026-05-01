export type ChatMessage = {
  timestamp: string;
  user: string | null;
  message: string;
};

export type WordStat = { word: string; score: number; count: number };

export type ParticipantStat = {
  user: string;
  numMessages: number;
  avgMsgLen: string;
  longestMsgLen: number;
  longestMsgText: string;
  nUniqueWords: number;
  topEmojis: string[];
  emojiCounts: Record<string, number>;
  /** Emojis per message (uses ÷ messages). */
  emojiFrequency: string;
  emojiFrequencyDetail: string;
  topWords: { word: string; count: number }[];
  topUniqueWords: WordStat[];
  topUniqueBigrams: WordStat[];
  nightOwlScore: string;
  nightOwlDetail: string;
  mediaCount: number;
  linkCount: number;
  longestGap: number;
  gapStart: Date | null;
  gapEnd: Date | null;
  lastMsgTime: Date | null;
};

export type SilenceRow = {
  duration: number;
  start: string;
  end: string;
  breaker: string | null;
};
