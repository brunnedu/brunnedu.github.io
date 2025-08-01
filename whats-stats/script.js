function parseWhatsAppChat(text) {
  const unwantedCharsRegex =
    /[\u200B\u200C\u200D\u202A\u202B\u202C\u202D\u202E\u200E\u200F\u00AD]/g;

  // Regex for headers like: 12/31/23, 11:59 PM - (captures full header)
  const headerRegex =
    /(?<full>(?<date>\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4}), (?<time>\d{1,2}:\d{2}) [\-\u2013] )/g;

  // Clean and normalize text
  text = text.replace(unwantedCharsRegex, '');
  text = text.normalize('NFKD');

  const matches = [...text.matchAll(headerRegex)];
  const messages = [];

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];

    const result = current.groups;
    const startIndex = current.index + current.groups.full.length;
    const endIndex = next ? next.index : text.length;

    // Extract raw message block between this header and next header
    let rawMessage = text.slice(startIndex, endIndex).trim();

    // Determine if user message or system message
    // User message pattern: "username: message"
    // If there is a colon after username, split accordingly
    let user = null;
    let message = rawMessage;

    // Check for colon presence to split user and message
    const colonIndex = rawMessage.indexOf(':');
    if (colonIndex !== -1) {
      // Extract possible username and message
      // But only if the colon is early enough (to avoid colons inside message)
      // Assume username is from start until colon (no line breaks in username)
      const possibleUser = rawMessage.slice(0, colonIndex).trim();
      const possibleMsg = rawMessage.slice(colonIndex + 1).trim();

      // If username looks reasonable (no newline, length > 0), treat as user message
      if (possibleUser.length > 0 && !possibleUser.includes('\n')) {
        user = possibleUser;
        message = possibleMsg;
      }
    }

    const timestamp = parseDateTime(result.date, result.time);

    messages.push({
      timestamp,
      user,
      message,
    });
  }

  return messages;
}

// Parse date and time to ISO string
function parseDateTime(date, time) {
  // Try MM/DD/YY, DD.MM.YYYY, etc.
  let d, parts;
  if (date.includes('/')) {
    // US: MM/DD/YY or MM/DD/YYYY
    parts = date.split('/');
    let year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
    d = new Date(`${year}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}T${time}`);
  } else if (date.includes('.')) {
    // EU: DD.MM.YYYY
    parts = date.split('.');
    let year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
    d = new Date(`${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}T${time}`);
  } else {
    d = new Date(date + 'T' + time);
  }
  return d.toISOString();
}

// --- DECRYPTION FUNCTION (from encryption.html) ---
function decryptChat(cipherText, password) {
  try {
    const bytes = CryptoJS.AES.decrypt(cipherText, password);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (!decrypted) throw new Error('Invalid password or corrupted file');
    return decrypted;
  } catch (e) {
    return null;
  }
}

function showMainSections() {
  document.getElementById('summary')?.classList.remove('hidden-on-load');
  document.getElementById('participant-summary-section')?.classList.remove('hidden-on-load');
  document.getElementById('visualizations')?.classList.remove('hidden-on-load');
}

function countWordOccurrences(
  messages,
  { byParticipant = false, ngram = 1, skipEmojis = false } = {}
) {
  // Clean phrases to remove
  const cleanPhrases = [
    /<Media omitted>/gi,
    /<This message was edited>/gi,
    /This message was deleted/gi,
    /live location shared/gi,
  ];
  const emojiRegex = /\p{Extended_Pictographic}/gu;
  // Helper to clean and split message
  function getWords(msg) {
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
    // { user: { word: count } }
    const counts = {};
    messages.forEach((m) => {
      if (!m.user) return; // Skip system messages or group modifications
      if (!counts[m.user]) counts[m.user] = {};
      const words = getWords(m.message);
      for (let i = 0; i <= words.length - ngram; i++) {
        const gram = words.slice(i, i + ngram).join(' ');
        if (gram) counts[m.user][gram] = (counts[m.user][gram] || 0) + 1;
      }
    });
    return counts;
  } else {
    // { word: count }
    const counts = {};
    messages.forEach((m) => {
      if (!m.user) return; // Skip system messages or group modifications
      const words = getWords(m.message);
      for (let i = 0; i <= words.length - ngram; i++) {
        const gram = words.slice(i, i + ngram).join(' ');
        if (gram) counts[gram] = (counts[gram] || 0) + 1;
      }
    });
    return counts;
  }
}

function getTopTfidfWordsPerParticipant(messages, { topN = 10, skipEmojis = true } = {}) {
  // 1. Get word counts per participant
  const userWordCounts = countWordOccurrences(messages, { byParticipant: true, skipEmojis });

  // 2. Compute document frequency (DF): for each word, in how many users' messages it appears
  const documentFrequency = {};
  const users = Object.keys(userWordCounts);

  users.forEach((user) => {
    const wordSet = new Set(Object.keys(userWordCounts[user]));
    wordSet.forEach((word) => {
      documentFrequency[word] = (documentFrequency[word] || 0) + 1;
    });
  });

  const numUsers = users.length;

  // 3. Compute TF-IDF and return top N per user
  const tfidfPerUser = {};

  users.forEach((user) => {
    const wordCounts = userWordCounts[user];
    const tfidfList = [];

    for (const word in wordCounts) {
      const tf = wordCounts[word]; // Term Frequency
      const df = documentFrequency[word]; // Document Frequency
      const idf = Math.log(numUsers / df); // Inverse Document Frequency
      const score = tf * idf;

      tfidfList.push({
        word,
        score,
        count: tf,
      });
    }

    // Sort by descending TF-IDF score and take top N
    tfidfList.sort((a, b) => b.score - a.score);
    tfidfPerUser[user] = tfidfList.slice(0, topN);
  });

  return tfidfPerUser;
}

// Show summary statistics in the UI
function showSummary(messages) {
  // Total messages
  const totalMessages = messages.length;
  // Participants
  const participants = Array.from(
    new Set(messages.map((m) => m.user).filter((user) => user !== null))
  );
  // Date range
  const dates = messages.map((m) => new Date(m.timestamp));
  const firstDate = new Date(Math.min(...dates));
  const lastDate = new Date(Math.max(...dates));
  // Total characters
  const totalChars = messages.reduce((sum, m) => sum + m.message.length, 0);
  // Messages per day
  const dayCounts = {};
  messages.forEach((m) => {
    const day = m.timestamp.slice(0, 10);
    dayCounts[day] = (dayCounts[day] || 0) + 1;
  });
  const avgPerDay = (totalMessages / Object.keys(dayCounts).length).toFixed(2);
  // Most active day
  const mostActiveDay = Object.entries(dayCounts).sort((a, b) => b[1] - a[1])[0];
  // Most active hour
  const hourCounts = {};
  messages.forEach((m) => {
    const hour = new Date(m.timestamp).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
  });
  const mostActiveHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0];

  // Render summary cards directly inside #summary (after h3)
  const summarySection = document.getElementById('summary');
  // Remove any previous summary cards
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

// Global Plotly chart style parameters
const PLOTLY_TITLE_SIZE = 20;
const PLOTLY_TICK_FONT_SIZE = 14;
const PLOTLY_LEFT_MARGIN = 80;

// Plotly Visualization: Message Activity Over Time
function renderActivityOverTime(messages) {
  const container = document.getElementById('viz-activity-over-time');
  container.innerHTML = '';
  // Prepare data: count messages per week
  const weekCounts = {};
  messages.forEach((m) => {
    const date = new Date(m.timestamp);
    const year = date.getFullYear();
    const week = getWeekNumber(date);
    const weekStr = `${year}-W${week.toString().padStart(2, '0')}`;
    weekCounts[weekStr] = (weekCounts[weekStr] || 0) + 1;
  });
  const data = Object.entries(weekCounts)
    .map(([week, count]) => ({ week, count }))
    .sort((a, b) => a.week.localeCompare(b.week));
  if (data.length === 0) {
    container.textContent = 'No data to display.';
    return;
  }
  const trace = {
    x: data.map((d) => d.week),
    y: data.map((d) => d.count),
    type: 'scatter',
    mode: 'lines+markers',
    marker: { color: '#2a6ebb' },
    line: { color: '#2a6ebb', width: 3 },
    hovertemplate: 'Week %{x}<br>%{y} messages<extra></extra>',
  };
  const layout = {
    title: { text: 'Messages Over Time', font: { size: PLOTLY_TITLE_SIZE } },
    margin: { l: PLOTLY_LEFT_MARGIN, r: 30, t: 60, b: 60 },
    xaxis: {
      title: 'Week',
      tickangle: -30,
      tickfont: { size: PLOTLY_TICK_FONT_SIZE },
      automargin: true,
      type: 'category',
      nticks: Math.min(12, data.length),
    },
    yaxis: {
      title: 'Messages',
      tickfont: { size: PLOTLY_TICK_FONT_SIZE },
      automargin: true,
    },
    plot_bgcolor: 'rgba(0,0,0,0)',
    paper_bgcolor: 'rgba(0,0,0,0)',
    showlegend: false,
    width: container.offsetWidth,
    height: 320,
  };
  Plotly.newPlot(container, [trace], layout, { responsive: true });
}

// Plotly Visualization: Hourly Activity Distribution (grouped by participant)
function renderHourlyActivity(messages) {
  const container = document.getElementById('viz-hourly-activity');
  container.innerHTML = '';
  // Prepare data: count messages per hour per participant
  let participants = Array.from(
    new Set(messages.map((m) => m.user).filter((user) => user !== null))
  );
  // Count total messages per participant
  const totalMessagesByUser = {};
  participants.forEach((user) => {
    totalMessagesByUser[user] = 0;
  });
  messages.forEach((m) => {
    totalMessagesByUser[m.user] = (totalMessagesByUser[m.user] || 0) + 1;
  });
  // Sort participants by total messages descending
  participants = participants.sort((a, b) => totalMessagesByUser[b] - totalMessagesByUser[a]);
  const hourCountsByUser = {};
  participants.forEach((user) => {
    hourCountsByUser[user] = Array(24).fill(0);
  });
  messages.forEach((m) => {
    if (!m.user) return;
    const hour = new Date(m.timestamp).getHours();
    hourCountsByUser[m.user][hour]++;
  });
  // Normalize by participant: fraction of their messages per hour
  const hourFractionsByUser = {};
  participants.forEach((user) => {
    const total = totalMessagesByUser[user] || 1;
    hourFractionsByUser[user] = hourCountsByUser[user].map((count) => count / total);
  });
  const participantColors = [
    '#2a6ebb',
    '#00b894',
    '#0984e3',
    '#00cec9',
    '#6c5ce7',
    '#fdcb6e',
    '#e17055',
    '#636e72',
  ];
  const traces = participants.map((user, idx) => ({
    x: Array.from({ length: 24 }, (_, i) => i),
    y: hourFractionsByUser[user],
    name: user,
    type: 'bar',
    marker: { color: participantColors[idx % participantColors.length] },
    hovertemplate: `${user}<br>Hour %{x}:00<br>%{y:.2f} of messages<extra></extra>`,
  }));
  const layout = {
    title: {
      text: 'Hourly Activity Distribution by Participant',
      font: { size: PLOTLY_TITLE_SIZE },
    },
    margin: { l: PLOTLY_LEFT_MARGIN, r: 30, t: 100, b: 80 },
    barmode: 'group',
    xaxis: {
      title: 'Hour',
      tickmode: 'array',
      tickvals: [0, 4, 8, 12, 16, 20, 23],
      ticktext: ['0', '4', '8', '12', '16', '20', '23'],
      tickfont: { size: PLOTLY_TICK_FONT_SIZE },
      automargin: true,
    },
    yaxis: {
      title: 'Fraction of Messages',
      tickfont: { size: PLOTLY_TICK_FONT_SIZE },
      automargin: true,
    },
    plot_bgcolor: 'rgba(0,0,0,0)',
    paper_bgcolor: 'rgba(0,0,0,0)',
    width: container.offsetWidth,
    height: 680,
  };
  Plotly.newPlot(container, traces, layout, { responsive: true });
}

// Plotly Visualization: Longest Streak by Participant
function renderLongestStreaks(messages) {
  const container = document.getElementById('viz-longest-streaks');
  container.innerHTML = '';

  // Get unique participants
  let participants = Array.from(
    new Set(messages.map((m) => m.user).filter((user) => user !== null))
  );

  // Count total messages per participant
  const totalMessagesByUser = {};
  participants.forEach((user) => {
    totalMessagesByUser[user] = 0;
  });
  messages.forEach((m) => {
    totalMessagesByUser[m.user] = (totalMessagesByUser[m.user] || 0) + 1;
  });

  // Sort participants by total messages descending (optional, can be changed)
  participants = participants.sort((a, b) => totalMessagesByUser[b] - totalMessagesByUser[a]);

  // Compute longest streaks per participant
  let streaks = participants.map((user) => {
    const userMsgs = messages.filter((m) => m.user === user);
    const dateSet = new Set(userMsgs.map((m) => new Date(m.timestamp).toISOString().slice(0, 10)));
    const dates = Array.from(dateSet).sort();

    let maxStreak = 0;
    let currentStreak = 1;
    let maxStart = null;
    let maxEnd = null;
    let streakStart = null;

    for (let i = 0; i < dates.length; i++) {
      if (i === 0) {
        streakStart = dates[i];
        continue;
      }
      const prev = new Date(dates[i - 1]);
      const curr = new Date(dates[i]);
      const diff = (curr - prev) / (1000 * 60 * 60 * 24);
      if (diff === 1) {
        currentStreak++;
      } else {
        if (currentStreak > maxStreak) {
          maxStreak = currentStreak;
          maxStart = streakStart;
          maxEnd = dates[i - 1];
        }
        currentStreak = 1;
        streakStart = dates[i];
      }
    }
    // Check last streak
    if (currentStreak > maxStreak) {
      maxStreak = currentStreak;
      maxStart = streakStart;
      maxEnd = dates[dates.length - 1];
    }
    return {
      user,
      maxStreak,
      maxStart,
      maxEnd,
    };
  });

  // Sort streaks descending by maxStreak
  streaks.sort((a, b) => b.maxStreak - a.maxStreak);

  // Reverse to have longest streaks at top of horizontal bar chart
  const participantColors = [
    '#2a6ebb',
    '#00b894',
    '#0984e3',
    '#00cec9',
    '#6c5ce7',
    '#fdcb6e',
    '#e17055',
    '#636e72',
  ];

  const users = streaks.map((s) => s.user).reverse();
  const maxStreaks = streaks.map((s) => s.maxStreak).reverse();
  const texts = streaks
    .map((s) => (s.maxStreak > 0 ? `${s.maxStart} → ${s.maxEnd}` : 'No streak'))
    .reverse();
  const colors = streaks
    .map((_, idx) => participantColors[idx % participantColors.length])
    .reverse();

  const traces = [
    {
      x: maxStreaks,
      y: users,
      text: texts,
      textposition: 'auto',
      type: 'bar',
      orientation: 'h',
      marker: { color: colors },
      hovertemplate: '%{y}<br>Longest streak: %{x} days<br>%{text}<extra></extra>',
    },
  ];

  const layout = {
    title: {
      text: 'Longest Streak by Participant (Consecutive Days with Messages)',
      font: { size: PLOTLY_TITLE_SIZE },
    },
    margin: { l: PLOTLY_LEFT_MARGIN, r: 30, t: 100, b: 60 },
    xaxis: {
      title: 'Longest Streak (days)',
      tickfont: { size: PLOTLY_TICK_FONT_SIZE },
      automargin: true,
    },
    yaxis: {
      title: 'Participant',
      tickfont: { size: PLOTLY_TICK_FONT_SIZE },
      automargin: true,
      // No categoryorder needed due to explicit reversal
    },
    plot_bgcolor: 'rgba(0,0,0,0)',
    paper_bgcolor: 'rgba(0,0,0,0)',
    width: container.offsetWidth,
    height: 200 + streaks.length * 30,
  };

  Plotly.newPlot(container, traces, layout, { responsive: true });
}

// Plotly Visualization: Weekly Pattern Heatmap
function renderWeeklyHeatmap(messages) {
  const container = document.getElementById('viz-weekly-heatmap');
  container.innerHTML = '';
  // Prepare data: count messages by day of week and hour
  const heatmap = Array.from({ length: 7 }, () => Array(24).fill(0));
  messages.forEach((m) => {
    const date = new Date(m.timestamp);
    const day = date.getDay();
    const hour = date.getHours();
    heatmap[day][hour]++;
  });
  const z = heatmap;
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hours = Array.from({ length: 24 }, (_, i) => i);
  const trace = {
    z: z,
    x: hours,
    y: days,
    type: 'heatmap',
    colorscale: 'YlGnBu',
    hoverongaps: false,
    colorbar: { title: 'Messages' },
    hovertemplate: '%{y}, %{x}:00<br>%{z} messages<extra></extra>',
  };
  const layout = {
    title: { text: 'Weekly Pattern', font: { size: PLOTLY_TITLE_SIZE } },
    margin: { l: PLOTLY_LEFT_MARGIN, r: 30, t: 60, b: 60 },
    xaxis: {
      title: 'Hour',
      tickmode: 'array',
      tickvals: [0, 4, 8, 12, 16, 20, 23],
      ticktext: ['0', '4', '8', '12', '16', '20', '23'],
      tickfont: { size: PLOTLY_TICK_FONT_SIZE },
      automargin: true,
    },
    yaxis: {
      title: 'Day',
      tickfont: { size: PLOTLY_TICK_FONT_SIZE },
      automargin: true,
    },
    plot_bgcolor: 'rgba(0,0,0,0)',
    paper_bgcolor: 'rgba(0,0,0,0)',
    width: container.offsetWidth,
    height: 340,
  };
  Plotly.newPlot(container, [trace], layout, { responsive: true });
}

// Plotly Visualization: Most Used Emojis
function renderEmojiChart(messages) {
  const container = document.getElementById('viz-emojis');
  container.innerHTML = '';
  // Use unified function for emoji counting
  const emojiCounts = countEmojiOccurrences(messages);
  // Add variation selector to legacy emoji for color rendering
  function withVariationSelector(emoji) {
    // List of legacy emoji codepoints that need VS16 for color
    const legacy = [
      '\u263A',
      '\u2665',
      '\u2660',
      '\u2663',
      '\u2666',
      '\u2600',
      '\u2601',
      '\u2602',
      '\u2603',
      '\u260E',
      '\u2614',
      '\u2615',
      '\u2648',
      '\u2649',
      '\u264A',
      '\u264B',
      '\u264C',
      '\u264D',
      '\u264E',
      '\u264F',
      '\u2650',
      '\u2651',
      '\u2652',
      '\u2653',
    ];
    // If emoji is a single codepoint and matches legacy, add VS16
    if (
      emoji.length === 1 &&
      legacy.includes('\\u' + emoji.charCodeAt(0).toString(16).toUpperCase())
    ) {
      return emoji + '\uFE0F';
    }
    // Also handle some common ones
    if (emoji === '☺') return '\u263A\uFE0F';
    if (emoji === '♥') return '\u2665\uFE0F';
    return emoji;
  }
  let data = Object.entries(emojiCounts)
    .map(([emoji, count]) => ({ emoji: withVariationSelector(emoji), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20); // Top 20
  if (data.length === 0) {
    container.textContent = 'No emojis found.';
    return;
  }
  const trace = {
    x: data.map((d) => d.emoji),
    y: data.map((d) => d.count),
    type: 'bar',
    marker: { color: '#2a6ebb' },
    hovertemplate: '%{y}<br>%{x} uses<extra></extra>',
  };
  const layout = {
    title: { text: 'Most Used Emojis', font: { size: PLOTLY_TITLE_SIZE } },
    margin: { l: PLOTLY_LEFT_MARGIN, r: 30, t: 60, b: 80 },
    xaxis: {
      title: 'Emoji',
      tickfont: { size: 24 },
      automargin: true,
    },
    yaxis: {
      title: 'Count',
      tickfont: { size: PLOTLY_TICK_FONT_SIZE },
      automargin: true,
    },
    plot_bgcolor: 'rgba(0,0,0,0)',
    paper_bgcolor: 'rgba(0,0,0,0)',
    showlegend: false,
    width: container.offsetWidth,
    height: 340,
  };
  Plotly.newPlot(container, [trace], layout, { responsive: true });
}

// Plotly Visualization: Most Used Words
function renderMostUsedWords(messages) {
  const container = document.getElementById('viz-most-used-words');
  container.innerHTML = '';
  // Use unified function for trigram (3-word sequence) frequencies
  const trigramCounts = countWordOccurrences(messages, { ngram: 3 });
  let data = Object.entries(trigramCounts)
    .map(([trigram, count]) => ({ trigram, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20); // Top 20
  if (data.length === 0) {
    container.textContent = 'No 3-word sequences found.';
    return;
  }
  const trace = {
    x: data.map((d) => d.count),
    y: data.map((d) => d.trigram),
    type: 'bar',
    orientation: 'h',
    marker: { color: '#2a6ebb' },
    hovertemplate: '%{y}<br>%{x} uses<extra></extra>',
  };
  const layout = {
    title: { text: 'Top 3-Word Sequences', font: { size: PLOTLY_TITLE_SIZE } },
    margin: { l: PLOTLY_LEFT_MARGIN + 60, r: 30, t: 60, b: 60 },
    xaxis: {
      title: 'Count',
      tickfont: { size: PLOTLY_TICK_FONT_SIZE },
      automargin: true,
    },
    yaxis: {
      title: '3-Word Sequence',
      tickfont: { size: 16 },
      automargin: true,
      categoryorder: 'total ascending',
    },
    plot_bgcolor: 'rgba(0,0,0,0)',
    paper_bgcolor: 'rgba(0,0,0,0)',
    showlegend: false,
    width: container.offsetWidth,
    height: Math.max(220, data.length * 36 + 120),
  };
  Plotly.newPlot(container, [trace], layout, { responsive: true });
}

// Plotly Visualization: Message Activity Over Time (Grouped by Participant, per week)
function renderActivityOverTimeGrouped(messages) {
  const container = document.getElementById('viz-activity-over-time-grouped');
  container.innerHTML = '';
  // Prepare data: count messages per week per participant
  let participants = Array.from(
    new Set(messages.map((m) => m.user).filter((user) => user !== null))
  );
  // Count total messages per participant
  const totalMessagesByUser = {};
  participants.forEach((user) => {
    totalMessagesByUser[user] = 0;
  });
  messages.forEach((m) => {
    totalMessagesByUser[m.user] = (totalMessagesByUser[m.user] || 0) + 1;
  });
  // Sort participants by total messages descending
  participants = participants.sort((a, b) => totalMessagesByUser[b] - totalMessagesByUser[a]);
  const weekCountsByUser = {};
  participants.forEach((user) => {
    weekCountsByUser[user] = {};
  });
  messages.forEach((m) => {
    if (!m.user) return; // skip or continue
    const date = new Date(m.timestamp);
    // Get ISO week string: YYYY-Www
    const year = date.getFullYear();
    const week = getWeekNumber(date);
    const weekStr = `${year}-W${week.toString().padStart(2, '0')}`;
    weekCountsByUser[m.user][weekStr] = (weekCountsByUser[m.user][weekStr] || 0) + 1;
  });
  // Get all week keys sorted
  const allWeeks = Array.from(
    new Set(Object.values(weekCountsByUser).flatMap((obj) => Object.keys(obj)))
  ).sort();
  // Prepare traces
  const participantColors = [
    '#2a6ebb',
    '#00b894',
    '#0984e3',
    '#00cec9',
    '#6c5ce7',
    '#fdcb6e',
    '#e17055',
    '#636e72',
  ];
  const traces = participants.map((user, idx) => ({
    x: allWeeks,
    y: allWeeks.map((week) => weekCountsByUser[user][week] || 0),
    name: user,
    type: 'scatter',
    mode: 'lines+markers',
    marker: { color: participantColors[idx % participantColors.length] },
    line: { color: participantColors[idx % participantColors.length], width: 3 },
    hovertemplate: `${user}<br>Week %{x}<br>%{y} messages<extra></extra>`,
  }));
  if (traces.every((trace) => trace.y.every((y) => y === 0))) {
    container.textContent = 'No data to display.';
    return;
  }
  const layout = {
    title: {
      text: 'Message Activity Over Time (Grouped by Participant, per Week)',
      font: { size: PLOTLY_TITLE_SIZE },
    },
    margin: { l: PLOTLY_LEFT_MARGIN, r: 30, t: 100, b: 80 },
    xaxis: {
      title: 'Week',
      tickangle: -30,
      tickfont: { size: PLOTLY_TICK_FONT_SIZE },
      automargin: true,
      type: 'category',
      nticks: Math.min(12, allWeeks.length),
    },
    yaxis: {
      title: 'Messages per Week',
      tickfont: { size: PLOTLY_TICK_FONT_SIZE },
      automargin: true,
    },
    plot_bgcolor: 'rgba(0,0,0,0)', // transparent plot area
    paper_bgcolor: 'rgba(0,0,0,0)', // transparent entire chart background
    width: container.offsetWidth,
    height: 680,
  };
  Plotly.newPlot(container, traces, layout, { responsive: true });
}
// Helper: Get ISO week number (1-53)
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

// Plotly Visualization: Message Activity Over Time (Stacked Area, Percent by Participant, per month)
function renderActivityOverTimeStackedPercent(messages) {
  const container = document.getElementById('viz-activity-over-time-stacked-percent');
  container.innerHTML = '';
  // Prepare data: count messages per month per participant
  let participants = Array.from(
    new Set(messages.map((m) => m.user).filter((user) => user !== null))
  );
  // Count total messages per participant
  const totalMessagesByUser = {};
  participants.forEach((user) => {
    totalMessagesByUser[user] = 0;
  });
  messages.forEach((m) => {
    totalMessagesByUser[m.user] = (totalMessagesByUser[m.user] || 0) + 1;
  });
  // Sort participants by total messages descending
  participants = participants.sort((a, b) => totalMessagesByUser[a] - totalMessagesByUser[b]);
  const monthCountsByUser = {};
  participants.forEach((user) => {
    monthCountsByUser[user] = {};
  });
  messages.forEach((m) => {
    if (!m.user) return; // skip or continue
    const date = new Date(m.timestamp);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const monthStr = `${year}-${month}`;
    monthCountsByUser[m.user][monthStr] = (monthCountsByUser[m.user][monthStr] || 0) + 1;
  });
  // Get all month keys sorted
  const allMonths = Array.from(
    new Set(Object.values(monthCountsByUser).flatMap((obj) => Object.keys(obj)))
  ).sort();
  // Compute total messages per month
  const totalPerMonth = allMonths.map((month) =>
    participants.reduce((sum, user) => sum + (monthCountsByUser[user][month] || 0), 0)
  );
  // Prepare traces as percent
  const participantColors = [
    '#2a6ebb',
    '#00b894',
    '#0984e3',
    '#00cec9',
    '#6c5ce7',
    '#fdcb6e',
    '#e17055',
    '#636e72',
  ];
  const traces = participants.map((user, idx) => ({
    x: allMonths,
    y: allMonths.map((month, i) => {
      const count = monthCountsByUser[user][month] || 0;
      const total = totalPerMonth[i] || 1;
      return (count / total) * 100;
    }),
    name: user,
    type: 'scatter',
    mode: 'lines',
    stackgroup: 'one',
    groupnorm: 'percent',
    marker: { color: participantColors[idx % participantColors.length] },
    line: { width: 0.5 },
    hovertemplate: `${user}<br>Month %{x}<br>%{y:.1f}% of messages<extra></extra>`,
  }));
  if (traces.every((trace) => trace.y.every((y) => y === 0))) {
    container.textContent = 'No data to display.';
    return;
  }
  const layout = {
    title: {
      text: 'Message Activity Over Time (Stacked Area, % by Participant, per Month)',
      font: { size: PLOTLY_TITLE_SIZE },
    },
    margin: { l: PLOTLY_LEFT_MARGIN, r: 30, t: 100, b: 80 },
    xaxis: {
      title: 'Month',
      tickangle: -30,
      tickfont: { size: PLOTLY_TICK_FONT_SIZE },
      automargin: true,
      type: 'category',
      nticks: Math.min(12, allMonths.length),
    },
    yaxis: {
      title: 'Share of Messages (%)',
      tickfont: { size: PLOTLY_TICK_FONT_SIZE },
      automargin: true,
      range: [0, 100],
    },
    plot_bgcolor: 'rgba(0,0,0,0)',
    paper_bgcolor: 'rgba(0,0,0,0)',
    width: container.offsetWidth,
    height: 680,
  };
  Plotly.newPlot(container, traces, layout, { responsive: true });
}

// Plotly Visualization: Histogram of Message Lengths (in characters)
function renderMessageLengthHistogram(messages) {
  const container = document.getElementById('viz-message-length-histogram');
  container.innerHTML = '';
  const lengths = messages.map((m) => m.message.length);
  if (lengths.length === 0) {
    container.textContent = 'No messages to display.';
    return;
  }
  const trace = {
    x: lengths,
    type: 'histogram',
    marker: { color: '#2a6ebb' },
    nbinsx: 200,
    hovertemplate: '%{x} characters: %{y} messages<extra></extra>',
  };
  const layout = {
    title: { text: 'Message Lengths', font: { size: PLOTLY_TITLE_SIZE } },
    margin: { l: PLOTLY_LEFT_MARGIN, r: 30, t: 60, b: 60 },
    xaxis: {
      title: 'Length (characters)',
      tickfont: { size: PLOTLY_TICK_FONT_SIZE },
      automargin: true,
    },
    yaxis: {
      title: 'Messages',
      tickfont: { size: PLOTLY_TICK_FONT_SIZE },
      automargin: true,
      type: 'log',
    },
    plot_bgcolor: 'rgba(0,0,0,0)',
    paper_bgcolor: 'rgba(0,0,0,0)',
    showlegend: false,
    width: container.offsetWidth,
    height: 340,
  };
  Plotly.newPlot(container, [trace], layout, { responsive: true });
}

// Unified word/ngram counting function
function countWordOccurrences(
  messages,
  { byParticipant = false, ngram = 1, skipEmojis = false } = {}
) {
  // Clean phrases to remove
  const cleanPhrases = [
    /<Media omitted>/gi,
    /<This message was edited>/gi,
    /This message was deleted/gi,
    /live location shared/gi,
  ];
  const emojiRegex = /\p{Extended_Pictographic}/gu;
  // Helper to clean and split message
  function getWords(msg) {
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
    // { user: { word: count } }
    const counts = {};
    messages.forEach((m) => {
      if (!m.user) return; // Skip system messages or group modifications
      if (!counts[m.user]) counts[m.user] = {};
      const words = getWords(m.message);
      for (let i = 0; i <= words.length - ngram; i++) {
        const gram = words.slice(i, i + ngram).join(' ');
        if (gram) counts[m.user][gram] = (counts[m.user][gram] || 0) + 1;
      }
    });
    return counts;
  } else {
    // { word: count }
    const counts = {};
    messages.forEach((m) => {
      if (!m.user) return; // Skip system messages or group modifications
      const words = getWords(m.message);
      for (let i = 0; i <= words.length - ngram; i++) {
        const gram = words.slice(i, i + ngram).join(' ');
        if (gram) counts[gram] = (counts[gram] || 0) + 1;
      }
    });
    return counts;
  }
}

// Unified emoji counting function
function countEmojiOccurrences(messages, { byParticipant = false } = {}) {
  const emojiRegex = /\p{Extended_Pictographic}/gu;
  const genderSigns = ['\u2640', '\u2642', '\u2640\uFE0F', '\u2642\uFE0F', '♀', '♂', '♀️', '♂️'];
  if (byParticipant) {
    const counts = {};
    messages.forEach((m) => {
      if (!counts[m.user]) counts[m.user] = {};
      const emojis = Array.from(m.message.matchAll(emojiRegex), (m) => m[0]);
      for (let i = 0; i < emojis.length; i++) {
        if (genderSigns.includes(emojis[i])) continue;
        counts[m.user][emojis[i]] = (counts[m.user][emojis[i]] || 0) + 1;
      }
    });
    return counts;
  } else {
    const counts = {};
    messages.forEach((m) => {
      const emojis = Array.from(m.message.matchAll(emojiRegex), (m) => m[0]);
      for (let i = 0; i < emojis.length; i++) {
        if (genderSigns.includes(emojis[i])) continue;
        counts[emojis[i]] = (counts[emojis[i]] || 0) + 1;
      }
    });
    return counts;
  }
}

// Helper to show error messages in visualization containers
function showVizError(containerId, err) {
  const container = document.getElementById(containerId);
  if (container) {
    container.innerHTML = ''; // Clear previous content
    container.textContent =
      'Error rendering chart: ' + (err && err.message ? err.message : 'Unknown error.');
    container.style.color = '#ff6b6b'; // Red color for error
    container.style.fontWeight = 'bold';
  }
}

// Helper to format duration in a human-readable way
function formatDuration(ms) {
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (day > 0) return `${day}d ${hr % 24}h`;
  if (hr > 0) return `${hr}h ${min % 60}m`;
  if (min > 0) return `${min}m ${sec % 60}s`;
  return `${sec}s`;
}

// Helper to format date as 'YYYY-MM-DD HH:MM'
function formatDateTimeNoSeconds(dateStr) {
  const d = new Date(dateStr);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

// Render participant summary cards
function renderParticipantSummaries(messages) {
  const container = document.getElementById('participant-summaries');
  if (!container) return;
  container.innerHTML = '';
  const participants = Array.from(
    new Set(messages.map((m) => m.user).filter((user) => user !== null))
  );
  // Prepare participant stats for sorting
  // Use unified function for per-participant word counts (skip emojis)
  const wordCountsByUser = countWordOccurrences(messages, {
    byParticipant: true,
    ngram: 1,
    skipEmojis: true,
  });
  // Use unified function for per-participant emoji counts
  const emojiCountsByUser = countEmojiOccurrences(messages, { byParticipant: true });
  // Get TF-IDF unique words per participant
  const uniqueWordsByUser = getTopTfidfWordsPerParticipant(messages, { topN: 5, skipEmojis: true });
  const participantStats = participants.map((user) => {
    const userMsgs = messages.filter((m) => m.user === user);
    const numMessages = userMsgs.length;
    const avgMsgLen =
      numMessages > 0
        ? (userMsgs.reduce((sum, m) => sum + m.message.length, 0) / numMessages).toFixed(1)
        : 0;
    // Most used emojis
    const emojiCounts = emojiCountsByUser[user] || {};
    const topEmojis = Object.entries(emojiCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([emoji]) => emoji);
    // Longest message
    let longestMsgText = '';
    let longestMsgLen = 0;
    userMsgs.forEach((m) => {
      if (m.message.length > longestMsgLen) {
        longestMsgLen = m.message.length;
        longestMsgText = m.message;
      }
    });
    // Unique words (vocabulary size) from wordCountsByUser
    const wordCounts = wordCountsByUser[user] || {};
    const nUniqueWords = Object.keys(wordCounts).length;
    // Most used words
    const topWords = Object.entries(wordCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word, count]) => ({ word, count }));
    // Most unique words from TF-IDF
    const topUniqueWords = uniqueWordsByUser[user] || [];
    // Longest gap between messages
    let longestGap = 0;
    let gapStart = null;
    let gapEnd = null;
    let lastMsgTime = null;
    if (userMsgs.length > 0) {
      // Sort messages by timestamp
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
      // Also consider the gap from their last message to the most recent message in the chat
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
      nUniqueWords, // use wordCountsByUser
      topEmojis,
      emojiCounts, // add this so the card can access counts for tooltips
      topWords, // now contains objects {word, count}
      topUniqueWords, // TF-IDF unique words
      longestGap,
      gapStart,
      gapEnd,
      lastMsgTime,
    };
  });
  // Sort by descending total messages
  participantStats.sort((a, b) => b.numMessages - a.numMessages);
  // Render cards
  participantStats.forEach((stat) => {
    const card = document.createElement('div');
    card.className = 'participant-summary-card';
    card.innerHTML = `
        <h4>${stat.user}</h4>
      <div class="stat-row"><span class="stat-label">Total Messages:</span> ${
        stat.numMessages
      }</div>
      <div class="stat-row"><span class="stat-label">Average Message Length:</span> ${
        stat.avgMsgLen
      }</div>
      <div class="stat-row"><span class="stat-label">Longest Message Length:</span> <span title="${stat.longestMsgText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')}">${stat.longestMsgLen}</span></div>
      <div class="stat-row"><span class="stat-label">Unique Words Used:</span> ${
        stat.nUniqueWords
      }</div>
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

function renderWordCloud(messages) {
  const container = document.getElementById('viz-word-cloud');
  container.innerHTML = '';

  // Get word counts (you can customize options)
  const wordCounts = countWordOccurrences(messages, { skipEmojis: true });

  // Convert to array and sort by frequency
  const sortedWords = Object.entries(wordCounts)
    .filter(([word, count]) => word.length > 1 && count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 100); // limit to top 100 words for clarity

  const words = sortedWords.map(([word]) => word);
  const counts = sortedWords.map(([, count]) => count);
  const totalMessages = messages.length;
  const ratios = counts.map((count) => count / totalMessages);

  // Normalize font sizes between 10 and 50
  const minSize = 10;
  const maxSize = 50;
  const minCount = Math.min(...counts);
  const maxCount = Math.max(...counts);
  const sizes = counts.map((count) =>
    minCount === maxCount
      ? (minSize + maxSize) / 2
      : minSize + ((count - minCount) / (maxCount - minCount)) * (maxSize - minSize)
  );

  const colors = words.map(() => `hsl(${Math.floor(Math.random() * 360)}, 70%, 45%)`);

  // Random layout positions
  const trace = {
    x: words.map(() => Math.random()),
    y: words.map(() => Math.random()),
    mode: 'text',
    type: 'scatter',
    text: words,
    textfont: {
      size: sizes,
      color: colors,
    },
    hovertemplate: words.map(
      (w, i) =>
        `<b>${w}</b><br>` +
        `Count: ${counts[i]}<br>` +
        `Appears in ${(ratios[i] * 100).toFixed(1)}% of messages` +
        `<extra></extra>`
    ),
    hoverinfo: 'text',
  };

  const layout = {
    title: { text: 'Word Cloud', font: { size: PLOTLY_TITLE_SIZE } },
    xaxis: { showgrid: false, showticklabels: false, zeroline: false },
    yaxis: { showgrid: false, showticklabels: false, zeroline: false },
    margin: { l: PLOTLY_LEFT_MARGIN, r: 0, t: 80, b: 0 },
    plot_bgcolor: 'rgba(0,0,0,0)',
    paper_bgcolor: 'rgba(0,0,0,0)',
    width: container.offsetWidth,
    height: 500,
  };

  Plotly.newPlot(container, [trace], layout, { responsive: true });
}

// Visualization: Longest Silences (Gaps Between Messages)
function renderLongestSilences(messages) {
  const container = document.getElementById('viz-longest-silences');
  container.innerHTML = '';
  if (!messages || messages.length < 2) {
    container.textContent = 'Not enough messages to compute silences.';
    return;
  }
  // Compute all silences (gaps between consecutive messages)
  const silences = [];
  for (let i = 1; i < messages.length; i++) {
    const prev = messages[i - 1];
    const curr = messages[i];
    const gap = new Date(curr.timestamp) - new Date(prev.timestamp);
    silences.push({
      duration: gap,
      start: prev.timestamp,
      end: curr.timestamp,
      breaker: curr.user,
    });
  }
  // Sort by duration descending, take top 5
  const topSilences = silences.sort((a, b) => b.duration - a.duration).slice(0, 5);
  if (topSilences.length === 0) {
    container.textContent = 'No silences found.';
    return;
  }
  // Render as a table
  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  table.innerHTML = `
    <thead>
      <tr style="background:#f0f4fa; color:#2a6ebb;">
        <th style="padding:0.5em 0.7em; text-align:center;">Duration</th>
        <th style="padding:0.5em 0.7em; text-align:center;">Start</th>
        <th style="padding:0.5em 0.7em; text-align:center;">End</th>
        <th style="padding:0.5em 0.7em; text-align:center;">Broken By</th>
      </tr>
    </thead>
    <tbody>
      ${topSilences
        .map(
          (s) => `
        <tr>
          <td style="padding:0.4em 0.7em; text-align:center;">${formatDuration(s.duration)}</td>
          <td style="padding:0.4em 0.7em; text-align:center;">${formatDateTimeNoSeconds(
            s.start
          )}</td>
          <td style="padding:0.4em 0.7em; text-align:center;">${formatDateTimeNoSeconds(s.end)}</td>
          <td style="padding:0.4em 0.7em; color:#2a6ebb; font-weight:600; text-align:center;">${
            s.breaker
          }</td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  `;
  // Add a title above the table
  const title = document.createElement('h4');
  title.textContent = 'Longest Silences';
  container.appendChild(title);
  container.appendChild(table);
}

let fileText;

document.addEventListener('DOMContentLoaded', function () {
  if (checkEncryptedFileFromHash()) return;
  checkEncryptedFileFromHash();
  renderUploadArea();
  attachUploadAreaListeners();
  const uploadArea = document.getElementById('upload-area');
  const fileInput = document.getElementById('file-input');
  const browseBtn = document.getElementById('browse-btn');
  const summaryDiv = document.querySelector('.summary-placeholder');

  // Helper: Show status
  function setStatus(msg, isSuccess = false) {
    // Remove any previous status or success message
    const prevStatus = uploadArea.querySelector('.upload-status-message');
    if (prevStatus) prevStatus.remove();
    // Insert new status message inside upload area
    const statusDiv = document.createElement('div');
    statusDiv.className = 'upload-status-message';
    statusDiv.style.marginTop = '1em';
    statusDiv.style.fontWeight = '600';
    statusDiv.style.color = isSuccess ? '#00b894' : '#d63031';
    statusDiv.textContent = msg;
    uploadArea.appendChild(statusDiv);
  }

  // --- ENCRYPTED CHAT LOADER ---
  // If URL hash is #file=filename.enc.txt, load and decrypt
  function checkEncryptedFileFromHash() {
    if (window.location.hash.startsWith('#file=')) {
      const filename = window.location.hash.slice(6);
      if (!filename.endsWith('.enc.txt')) return true;
      renderUploadArea({ encryptedMode: true, filename });
      attachUploadAreaListeners({ encryptedMode: true, filename });
      return true;
    }
    return false;
  }

  // --- END ENCRYPTED CHAT LOADER ---

  // --- UPLOAD AREA RENDERING ---
  function renderUploadArea({ encryptedMode = false, filename = '' } = {}) {
    const uploadArea = document.getElementById('upload-area');
    if (!uploadArea) return;
    uploadArea.classList.remove('success');
    if (encryptedMode) {
      uploadArea.innerHTML = `
        <div style="margin-bottom:1em; font-size:1.1em; color:#2a6ebb;">Decrypt encrypted chat file: <b>${filename}</b></div>
        <div style="position: relative; width: 80%; max-width: 320px; margin: 0 auto;">
          <input type="password" id="decrypt-password" placeholder="Enter decryption password" style="width: 100%; padding: 0.5em 2.5em 0.5em 0.5em; font-size: 1em; box-sizing: border-box;" />
          <button id="toggle-password" type="button" style="position: absolute; right: 0.5em; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #666; padding: 0.2em;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
            </svg>
          </button>
        </div>
        <button id="decrypt-btn" style="margin-top: 0.7em; background: #2a6ebb; color: #fff; border: none; border-radius: 5px; padding: 0.7rem 1.2rem; font-size: 1rem; font-weight: 600; cursor: pointer;">Decrypt & Load</button>
        <div id="decrypt-status" style="margin-top: 1em; font-weight: 600;"></div>
      `;
    } else {
      uploadArea.innerHTML = `
        <input type="file" id="file-input" accept=".txt" style="display: none" />
        <div class="button-container">
          <button id="sample-btn" type="button">Try Sample Chat</button>
          <div class="or-divider">or</div>
          <button id="browse-btn" type="button">Upload Your Chat</button>
        </div>
        <p>drag & drop your WhatsApp chat file</p>
      `;
    }
  }

  function attachUploadAreaListeners({ encryptedMode = false, filename = '' } = {}) {
    const uploadArea = document.getElementById('upload-area');
    if (!uploadArea) return;
    if (encryptedMode) {
      const decryptBtn = document.getElementById('decrypt-btn');
      const passwordInput = document.getElementById('decrypt-password');
      const togglePasswordBtn = document.getElementById('toggle-password');
      const statusDiv = document.getElementById('decrypt-status');

      // Password toggle functionality
      if (togglePasswordBtn && passwordInput) {
        togglePasswordBtn.addEventListener('click', () => {
          if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            togglePasswordBtn.innerHTML = `
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>
              </svg>
            `;
          } else {
            passwordInput.type = 'password';
            togglePasswordBtn.innerHTML = `
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
              </svg>
            `;
          }
        });
      }

      // Enter key functionality
      if (passwordInput) {
        passwordInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            decryptBtn.click();
          }
        });
      }

      if (decryptBtn && passwordInput) {
        decryptBtn.addEventListener('click', () => {
          statusDiv.textContent = 'Decrypting...';
          fetch(`encrypted-chats/${filename}`)
            .then((response) => {
              if (!response.ok) throw new Error('File not found');
              return response.text();
            })
            .then((encryptedText) => {
              const password = passwordInput.value;
              if (!password) {
                statusDiv.textContent = 'Please enter a password.';
                statusDiv.style.color = '#d63031';
                return;
              }
              let decrypted;
              try {
                decrypted = decryptChat(encryptedText, password);
              } catch (e) {
                decrypted = null;
              }
              if (!decrypted) {
                statusDiv.textContent = '❌ Failed to decrypt. Wrong password or corrupted file.';
                statusDiv.style.color = '#d63031';
                return;
              }
              statusDiv.textContent = 'Encrypted chat decrypted successfully! 🎉';
              statusDiv.style.color = '#00b894';
              let messages = [];
              try {
                messages = parseWhatsAppChat(decrypted);
                lastLoadedMessages = messages;
                showMainSections();
                showSummary(messages);
                renderParticipantSummaries(messages);
                renderWordCloud(messages);
                try {
                  renderActivityOverTime(messages);
                } catch (err) {
                  showVizError('viz-activity-over-time', err);
                }
                try {
                  renderHourlyActivity(messages);
                } catch (err) {
                  showVizError('viz-hourly-activity', err);
                }
                try {
                  renderLongestStreaks(messages);
                } catch (err) {
                  showVizError('viz-longest-streaks', err);
                }
                try {
                  renderWeeklyHeatmap(messages);
                } catch (err) {
                  showVizError('viz-weekly-heatmap', err);
                }
                try {
                  renderEmojiChart(messages);
                } catch (err) {
                  showVizError('viz-emojis', err);
                }
                try {
                  renderEmojiTrends(messages);
                } catch (err) {
                  showVizError('viz-emoji-trends', err);
                }
                try {
                  renderMostUsedWords(messages);
                } catch (err) {
                  showVizError('viz-most-used-words', err);
                }
                try {
                  renderActivityOverTimeGrouped(messages);
                } catch (err) {
                  showVizError('viz-activity-over-time-grouped', err);
                }
                try {
                  renderActivityOverTimeStackedPercent(messages);
                } catch (err) {
                  showVizError('viz-activity-over-time-stacked-percent', err);
                }
                try {
                  renderMessageLengthHistogram(messages);
                } catch (err) {
                  showVizError('viz-message-length-histogram', err);
                }
                try {
                  renderLongestSilences(messages);
                } catch (err) {
                  showVizError('viz-longest-silences', err);
                }
              } catch (err) {
                statusDiv.textContent = '❌ Decryption succeeded, but failed to parse chat file.';
                statusDiv.style.color = '#d63031';
              }
            })
            .catch((err) => {
              statusDiv.textContent = `Error loading encrypted file: ${err.message}`;
              statusDiv.style.color = '#d63031';
            });
        });
      }
    } else {
      const fileInput = document.getElementById('file-input');
      const browseBtn = document.getElementById('browse-btn');
      const sampleBtn = document.getElementById('sample-btn');
      if (browseBtn && fileInput) {
        browseBtn.addEventListener('click', () => fileInput.click());
      }
      if (sampleBtn) {
        sampleBtn.addEventListener('click', () => {
          setStatus('Loading sample chat...', true);
          fetch('assets/WhatsApp Chat Sample.txt')
            .then((response) => {
              if (!response.ok) {
                throw new Error('Failed to load sample file');
              }
              return response.text();
            })
            .then((text) => {
              setStatus('Parsing sample chat...', true);
              let messages = [];
              try {
                messages = parseWhatsAppChat(text);
                lastLoadedMessages = messages;
                if (!messages.length) {
                  setStatus('No valid messages found in sample file.');
                  return;
                }
                setStatus('Sample chat loaded successfully!', true);
                renderUploadArea();
                attachUploadAreaListeners();
                showMainSections();
                showSummary(messages);
                renderParticipantSummaries(messages);
                renderWordCloud(messages);
                const fileUploadSection = document.getElementById('file-upload');
                if (fileUploadSection) {
                  fileUploadSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              } catch (err) {
                setStatus(
                  'Error parsing sample: ' + (err && err.message ? err.message : 'Unknown error.')
                );
                return;
              }
              try {
                renderActivityOverTime(messages);
              } catch (err) {
                showVizError('viz-activity-over-time', err);
              }
              try {
                renderHourlyActivity(messages);
              } catch (err) {
                showVizError('viz-hourly-activity', err);
              }
              try {
                renderLongestStreaks(messages);
              } catch (err) {
                showVizError('viz-longest-streaks', err);
              }
              try {
                renderWeeklyHeatmap(messages);
              } catch (err) {
                showVizError('viz-weekly-heatmap', err);
              }
              try {
                renderEmojiChart(messages);
              } catch (err) {
                showVizError('viz-emojis', err);
              }
              try {
                renderEmojiTrends(messages);
              } catch (err) {
                showVizError('viz-emoji-trends', err);
              }
              try {
                renderMostUsedWords(messages);
              } catch (err) {
                showVizError('viz-most-used-words', err);
              }
              try {
                renderActivityOverTimeGrouped(messages);
              } catch (err) {
                showVizError('viz-activity-over-time-grouped', err);
              }
              try {
                renderActivityOverTimeStackedPercent(messages);
              } catch (err) {
                showVizError('viz-activity-over-time-stacked-percent', err);
              }
              try {
                renderMessageLengthHistogram(messages);
              } catch (err) {
                showVizError('viz-message-length-histogram', err);
              }
              try {
                renderLongestSilences(messages);
              } catch (err) {
                showVizError('viz-longest-silences', err);
              }
            })
            .catch((error) => {
              setStatus('Error loading sample file: ' + error.message);
            });
        });
      }
      if (fileInput) {
        fileInput.addEventListener('change', (e) => {
          if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
          }
        });
      }
      // Drag & drop events
      uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
      });
      uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
      });
      uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          handleFile(e.dataTransfer.files[0]);
        }
      });
    }
  }
  // --- END UPLOAD AREA RENDERING ---

  // Click browse button triggers file input
  if (browseBtn && fileInput) {
    browseBtn.addEventListener('click', () => fileInput.click());
  }

  // Sample chat button functionality
  const sampleBtn = document.getElementById('sample-btn');
  if (sampleBtn) {
    sampleBtn.addEventListener('click', () => {
      setStatus('Loading sample chat...', true);
      fetch('assets/WhatsApp Chat Sample.txt')
        .then((response) => {
          if (!response.ok) {
            throw new Error('Failed to load sample file');
          }
          return response.text();
        })
        .then((text) => {
          setStatus('Parsing sample chat...', true);
          let messages = [];
          try {
            messages = parseWhatsAppChat(text);
            lastLoadedMessages = messages;
            if (!messages.length) {
              setStatus('No valid messages found in sample file.');
              return;
            }
            setStatus('Sample chat loaded successfully!', true);
            renderUploadArea();
            attachUploadAreaListeners();
            showMainSections();
            showSummary(messages);
            renderParticipantSummaries(messages);
            renderWordCloud(messages);
            const fileUploadSection = document.getElementById('file-upload');
            if (fileUploadSection) {
              fileUploadSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          } catch (err) {
            setStatus(
              'Error parsing sample: ' + (err && err.message ? err.message : 'Unknown error.')
            );
            return;
          }
          // Render visualizations, catch errors per chart
          try {
            renderActivityOverTime(messages);
          } catch (err) {
            showVizError('viz-activity-over-time', err);
          }
          try {
            renderHourlyActivity(messages);
          } catch (err) {
            showVizError('viz-hourly-activity', err);
          }
          try {
            renderLongestStreaks(messages);
          } catch (err) {
            showVizError('viz-longest-streaks', err);
          }
          try {
            renderWeeklyHeatmap(messages);
          } catch (err) {
            showVizError('viz-weekly-heatmap', err);
          }
          try {
            renderEmojiChart(messages);
          } catch (err) {
            showVizError('viz-emojis', err);
          }
          try {
            renderEmojiTrends(messages);
          } catch (err) {
            showVizError('viz-emoji-trends', err);
          }
          try {
            renderMostUsedWords(messages);
          } catch (err) {
            showVizError('viz-most-used-words', err);
          }
          try {
            renderActivityOverTimeGrouped(messages);
          } catch (err) {
            showVizError('viz-activity-over-time-grouped', err);
          }
          try {
            renderActivityOverTimeStackedPercent(messages);
          } catch (err) {
            showVizError('viz-activity-over-time-stacked-percent', err);
          }
          try {
            renderMessageLengthHistogram(messages);
          } catch (err) {
            showVizError('viz-message-length-histogram', err);
          }
          try {
            renderLongestSilences(messages);
          } catch (err) {
            showVizError('viz-longest-silences', err);
          }
        })
        .catch((error) => {
          setStatus('Error loading sample file: ' + error.message);
        });
    });
  }

  // Handle file input change
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleFile(e.target.files[0]);
      }
    });
  }

  // Drag & drop events
  if (uploadArea) {
    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('dragover');
    });
    uploadArea.addEventListener('dragleave', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('dragover');
    });
    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('dragover');
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFile(e.dataTransfer.files[0]);
      }
    });
  }

  // Core file handler
  function handleFile(file) {
    if (!file.name.endsWith('.txt')) {
      setStatus('Please upload a .txt file exported from WhatsApp.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      // 5MB limit
      setStatus('File is too large. Please upload a file smaller than 5MB.');
      return;
    }
    setStatus('Reading file...', true);
    const reader = new FileReader();
    reader.onload = function (e) {
      setStatus('Parsing chat...', true);
      const text = e.target.result;
      fileText = e.target.result;
      let messages = [];
      try {
        messages = parseWhatsAppChat(text);
        lastLoadedMessages = messages; // store globally for resize
        if (!messages.length) {
          setStatus('No valid messages found. Please check your file format.');
          summaryDiv.innerHTML = '';
          return;
        }
        setStatus('File parsed successfully!', true);
        renderUploadArea();
        attachUploadAreaListeners();
        showMainSections();
        showSummary(messages);
        renderParticipantSummaries(messages);
        renderWordCloud(messages); // Call renderWordCloud after parsing
        // Smooth scroll to chat summary
        const fileUploadSection = document.getElementById('file-upload');
        if (fileUploadSection) {
          fileUploadSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      } catch (err) {
        setStatus('Summary error: ' + (err && err.message ? err.message : 'Unknown error.'));
        summaryDiv.innerHTML = '';
        return;
      }
      // Render visualizations, catch errors per chart
      try {
        renderActivityOverTime(messages);
      } catch (err) {
        showVizError('viz-activity-over-time', err);
      }
      try {
        renderHourlyActivity(messages);
      } catch (err) {
        showVizError('viz-hourly-activity', err);
      }
      try {
        renderLongestStreaks(messages);
      } catch (err) {
        showVizError('viz-longest-streaks', err);
      }
      try {
        renderWeeklyHeatmap(messages);
      } catch (err) {
        showVizError('viz-weekly-heatmap', err);
      }
      try {
        renderEmojiChart(messages);
      } catch (err) {
        showVizError('viz-emojis', err);
      }
      try {
        renderEmojiTrends(messages);
      } catch (err) {
        showVizError('viz-emoji-trends', err);
      }
      try {
        renderMostUsedWords(messages);
      } catch (err) {
        showVizError('viz-most-used-words', err);
      }
      try {
        renderActivityOverTimeGrouped(messages);
      } catch (err) {
        showVizError('viz-activity-over-time-grouped', err);
      }
      try {
        renderActivityOverTimeStackedPercent(messages);
      } catch (err) {
        showVizError('viz-activity-over-time-stacked-percent', err);
      }
      try {
        renderMessageLengthHistogram(messages);
      } catch (err) {
        showVizError('viz-message-length-histogram', err);
      }
      try {
        renderLongestSilences(messages);
      } catch (err) {
        showVizError('viz-longest-silences', err);
      }
    };
    reader.onerror = function () {
      setStatus('Error reading file. Please try again.');
    };
    reader.readAsText(file);
  }
});

// --- END DECRYPTION FUNCTION ---

let lastLoadedMessages = null;

// At the end of DOMContentLoaded
window.addEventListener('resize', function () {
  if (lastLoadedMessages) {
    try {
      renderActivityOverTime(lastLoadedMessages);
    } catch (err) {
      showVizError('viz-activity-over-time', err);
    }
    try {
      renderHourlyActivity(lastLoadedMessages);
    } catch (err) {
      showVizError('viz-hourly-activity', err);
    }
    try {
      renderLongestStreaks(lastLoadedMessages);
    } catch (err) {
      showVizError('viz-longest-streaks', err);
    }
    try {
      renderWeeklyHeatmap(lastLoadedMessages);
    } catch (err) {
      showVizError('viz-weekly-heatmap', err);
    }
    try {
      renderEmojiChart(lastLoadedMessages);
    } catch (err) {
      showVizError('viz-emojis', err);
    }
    try {
      renderEmojiTrends(lastLoadedMessages);
    } catch (err) {
      showVizError('viz-emoji-trends', err);
    }
    try {
      renderMostUsedWords(lastLoadedMessages);
    } catch (err) {
      showVizError('viz-most-used-words', err);
    }
    try {
      renderActivityOverTimeGrouped(lastLoadedMessages);
    } catch (err) {
      showVizError('viz-activity-over-time-grouped', err);
    }
    try {
      renderActivityOverTimeStackedPercent(lastLoadedMessages);
    } catch (err) {
      showVizError('viz-activity-over-time-stacked-percent', err);
    }
    try {
      renderMessageLengthHistogram(lastLoadedMessages);
    } catch (err) {
      showVizError('viz-message-length-histogram', err);
    }
    try {
      renderLongestSilences(lastLoadedMessages);
    } catch (err) {
      showVizError('viz-longest-silences', err);
    }
    try {
      renderWordCloud(lastLoadedMessages);
    } catch (err) {
      showVizError('viz-word-cloud', err);
    }
  }
});

// Plotly Visualization: Emoji Trends Over Time
function renderEmojiTrends(messages) {
  const container = document.getElementById('viz-emoji-trends');
  container.innerHTML = '';

  // Get top 10 most used emojis overall
  const emojiCounts = countEmojiOccurrences(messages);
  const topEmojis = Object.entries(emojiCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([emoji]) => emoji);

  if (topEmojis.length === 0) {
    container.textContent = 'No emojis found.';
    return;
  }

  // Count emoji usage per month for each top emoji
  const monthCountsByEmoji = {};
  topEmojis.forEach((emoji) => {
    monthCountsByEmoji[emoji] = {};
  });

  messages.forEach((m) => {
    const date = new Date(m.timestamp);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const monthStr = `${year}-${month}`;

    // Find all emojis in this message
    const emojiRegex = /\p{Extended_Pictographic}/gu;
    const genderSigns = ['\u2640', '\u2642', '\u2640\uFE0F', '\u2642\uFE0F', '♀', '♂', '♀️', '♂️'];
    const emojis = Array.from(m.message.matchAll(emojiRegex), (m) => m[0]);

    emojis.forEach((emoji) => {
      if (genderSigns.includes(emoji)) return; // Skip gender signs
      if (topEmojis.includes(emoji)) {
        monthCountsByEmoji[emoji][monthStr] = (monthCountsByEmoji[emoji][monthStr] || 0) + 1;
      }
    });
  });

  // Get all month keys sorted
  const allMonths = Array.from(
    new Set(Object.values(monthCountsByEmoji).flatMap((obj) => Object.keys(obj)))
  ).sort();

  if (allMonths.length === 0) {
    container.textContent = 'No emoji usage data to display.';
    return;
  }

  // Prepare traces for each emoji
  const emojiColors = [
    '#2a6ebb',
    '#00b894',
    '#0984e3',
    '#00cec9',
    '#6c5ce7',
    '#fdcb6e',
    '#e17055',
    '#636e72',
    '#fd79a8',
    '#fdcb6e',
  ];

  const traces = topEmojis.map((emoji, idx) => ({
    x: allMonths,
    y: allMonths.map((month) => monthCountsByEmoji[emoji][month] || 0),
    name: emoji,
    type: 'scatter',
    mode: 'lines+markers',
    marker: { color: emojiColors[idx % emojiColors.length] },
    line: { color: emojiColors[idx % emojiColors.length], width: 3 },
    hovertemplate: `${emoji}<br>Month %{x}<br>%{y} uses<extra></extra>`,
  }));

  const layout = {
    title: {
      text: 'Top 10 Emojis - Usage Trends Over Time',
      font: { size: PLOTLY_TITLE_SIZE },
    },
    margin: { l: PLOTLY_LEFT_MARGIN, r: 30, t: 100, b: 80 },
    xaxis: {
      title: 'Month',
      tickangle: -30,
      tickfont: { size: PLOTLY_TICK_FONT_SIZE },
      automargin: true,
      type: 'category',
      nticks: Math.min(12, allMonths.length),
    },
    yaxis: {
      title: 'Usage Count',
      tickfont: { size: PLOTLY_TICK_FONT_SIZE },
      automargin: true,
    },
    plot_bgcolor: 'rgba(0,0,0,0)',
    paper_bgcolor: 'rgba(0,0,0,0)',
    width: container.offsetWidth,
    height: 500,
  };

  Plotly.newPlot(container, traces, layout, { responsive: true });
}
