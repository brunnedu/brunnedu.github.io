import { formatDuration } from './utils.js';
import { countWordOccurrences, countEmojiOccurrences, getTopTfidfWordsPerParticipant } from './analysis.js';

export function showSummary(messages) {
  const totalMessages = messages.length;
  const participants = Array.from(
    new Set(messages.map((m) => m.user).filter((user) => user !== null))
  );
  const dates = messages.map((m) => new Date(m.timestamp));
  const firstDate = new Date(Math.min(...dates));
  const lastDate = new Date(Math.max(...dates));
  const totalChars = messages.reduce((sum, m) => sum + m.message.length, 0);
  const dayCounts = {};
  messages.forEach((m) => {
    const day = m.timestamp.slice(0, 10);
    dayCounts[day] = (dayCounts[day] || 0) + 1;
  });
  const avgPerDay = (totalMessages / Object.keys(dayCounts).length).toFixed(2);
  const mostActiveDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0];
  const hourCounts = {};
  messages.forEach((m) => {
    const hour = new Date(m.timestamp).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });
  const mostActiveHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];

  const summarySection = document.getElementById('summary');
  Array.from(summarySection.querySelectorAll('.summary-cards')).forEach((el) => el.remove());
  const cards = document.createElement('div');
  cards.className = 'summary-cards';
  cards.innerHTML = `
      <div class="summary-card"><strong>Total Messages</strong><br>${totalMessages}</div>
      <div class="summary-card"><strong>Participants</strong><br>${participants.length}</div>
      <div class="summary-card"><strong>Date Range</strong><br>${firstDate.toLocaleDateString()} – ${lastDate.toLocaleDateString()}</div>
      <div class="summary-card"><strong>Total Characters</strong><br>${totalChars}</div>
      <div class="summary-card"><strong>Avg. Messages/Day</strong><br>${avgPerDay}</div>
    <div class="summary-card"><strong>Most Active Day</strong><br>${
      mostActiveDay ? mostActiveDay[0] + ' (' + mostActiveDay[1] + ')' : '-'
    }</div>
    <div class="summary-card"><strong>Most Active Hour</strong><br>${
      mostActiveHour ? mostActiveHour[0] + ':00 (' + mostActiveHour[1] + ')' : '-'
    }</div>
    `;
  summarySection.appendChild(cards);
}

export function renderParticipantSummaries(messages) {
  const container = document.getElementById('participant-summaries');
  if (!container) return;
  container.innerHTML = '';
  const participants = Array.from(
    new Set(messages.map((m) => m.user).filter((user) => user !== null))
  );
  const wordCountsByUser = countWordOccurrences(messages, {
    byParticipant: true,
    ngram: 1,
    skipEmojis: true,
  });
  const emojiCountsByUser = countEmojiOccurrences(messages, { byParticipant: true });
  const uniqueWordsByUser = getTopTfidfWordsPerParticipant(messages, { topN: 5, skipEmojis: true });
  const participantStats = participants.map((user) => {
    const userMsgs = messages.filter((m) => m.user === user);
    const numMessages = userMsgs.length;
    const avgMsgLen =
      numMessages > 0
        ? (userMsgs.reduce((sum, m) => sum + m.message.length, 0) / numMessages).toFixed(1)
        : 0;
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
    let gapStart = null;
    let gapEnd = null;
    let lastMsgTime = null;
    if (userMsgs.length > 0) {
      const sortedMsgs = userMsgs
        .slice()
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      lastMsgTime = new Date(sortedMsgs[sortedMsgs.length - 1].timestamp);
      for (let i = 1; i < sortedMsgs.length; i++) {
        const prev = new Date(sortedMsgs[i - 1].timestamp);
        const curr = new Date(sortedMsgs[i].timestamp);
        const gap = curr - prev;
        if (gap > longestGap) {
          longestGap = gap;
          gapStart = prev;
          gapEnd = curr;
        }
      }
      const mostRecentMsg = messages.reduce((a, b) =>
        new Date(a.timestamp) > new Date(b.timestamp) ? a : b
      );
      const gapToNow = new Date(mostRecentMsg.timestamp) - lastMsgTime;
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
  participantStats.forEach((stat) => {
    const card = document.createElement('div');
    card.className = 'participant-summary-card';
    card.innerHTML = `
        <h4>${stat.user}</h4>
      <div class="stat-row"><span class="stat-label">Total Messages:</span> ${stat.numMessages}</div>
      <div class="stat-row"><span class="stat-label">Average Message Length:</span> ${stat.avgMsgLen}</div>
      <div class="stat-row"><span class="stat-label">Longest Message Length:</span> <span title="${stat.longestMsgText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')}">${stat.longestMsgLen}</span></div>
      <div class="stat-row"><span class="stat-label">Unique Words Used:</span> ${stat.nUniqueWords}</div>
      <div class="stat-row"><span class="stat-label">Longest Gap:</span> <span title="${
        stat.gapStart && stat.gapEnd
          ? `${stat.gapStart.toLocaleString()} → ${stat.gapEnd.toLocaleString()}`
          : ''
      }">${stat.longestGap ? formatDuration(stat.longestGap) : '—'}</span></div>
      <div class="stat-row"><span class="stat-label">Last Message:</span> <span title="${
        stat.lastMsgTime ? stat.lastMsgTime.toLocaleString() : ''
      }">${stat.lastMsgTime ? stat.lastMsgTime.toLocaleDateString() : '—'}</span></div>
      <div class="stat-row stat-most-used-emojis"><span class="stat-label">Most Used Emojis</span></div>
      <div class="top-words-list">${
        stat.topEmojis
          .map((e) => `<span class="top-word" title="${stat.emojiCounts[e]} uses">${e}</span>`)
          .join('') || '—'
      }</div>
      <div class="stat-row stat-most-used-words"><span class="stat-label">Most Used Words</span></div>
      <div class="top-words-list">${
        stat.topWords
          .map((w) => `<span class="top-word" title="${w.count} uses">${w.word}</span>`)
          .join('') || '—'
      }</div>
      <div class="stat-row stat-unique-words"><span class="stat-label">Most Unique Words</span></div>
      <div class="top-words-list">${
        stat.topUniqueWords
          .map(
            (w) =>
              `<span class="top-word" title="${w.word} (${
                w.count
              } uses, TF-IDF score: ${w.score.toFixed(3)})">${w.word}</span>`
          )
          .join('') || '—'
      }</div>
      `;
    container.appendChild(card);
  });
}
