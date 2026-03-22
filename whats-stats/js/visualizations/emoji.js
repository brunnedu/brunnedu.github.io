import {
  getTimeRangeFromMessages,
  generateMonthlyBuckets,
  getMonthKey,
  getPlotlyLayoutSizes,
  getChartHeightPx,
  getPlotlyConfig,
} from '../utils.js';
import { countEmojiOccurrences } from '../analysis.js';

function withVariationSelector(emoji) {
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
  if (
    emoji.length === 1 &&
    legacy.includes('\\u' + emoji.charCodeAt(0).toString(16).toUpperCase())
  ) {
    return emoji + '\uFE0F';
  }
  if (emoji === '☺') return '\u263A\uFE0F';
  if (emoji === '♥') return '\u2665\uFE0F';
  return emoji;
}

export function renderEmojiChart(messages) {
  const container = document.getElementById('viz-emojis');
  container.innerHTML = '';
  const emojiCounts = countEmojiOccurrences(messages);
  const data = Object.entries(emojiCounts)
    .map(([emoji, count]) => ({ emoji: withVariationSelector(emoji), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
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
  const L = getPlotlyLayoutSizes();
  const emojiTick = typeof window !== 'undefined' && window.innerWidth < 600 ? 20 : 24;
  const layout = {
    title: { text: 'Most Used Emojis', font: { size: L.title } },
    margin: { l: L.left, r: 30, t: 60, b: 80 },
    xaxis: {
      title: 'Emoji',
      tickfont: { size: emojiTick },
      automargin: true,
    },
    yaxis: {
      title: 'Count',
      tickfont: { size: L.tick },
      automargin: true,
    },
    plot_bgcolor: 'rgba(0,0,0,0)',
    paper_bgcolor: 'rgba(0,0,0,0)',
    showlegend: false,
    width: container.offsetWidth,
    height: getChartHeightPx('small'),
  };
  Plotly.newPlot(container, [trace], layout, getPlotlyConfig());
}

export function renderEmojiTrends(messages) {
  const container = document.getElementById('viz-emoji-trends');
  container.innerHTML = '';

  const emojiCounts = countEmojiOccurrences(messages);
  const topEmojis = Object.entries(emojiCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([emoji]) => emoji);

  if (topEmojis.length === 0) {
    container.textContent = 'No emojis found.';
    return;
  }

  const { minDate, maxDate } = getTimeRangeFromMessages(messages);
  if (!minDate || !maxDate) {
    container.textContent = 'No emoji usage data to display.';
    return;
  }

  const bucketDates = generateMonthlyBuckets(minDate, maxDate);
  const monthCountsByEmoji = {};
  topEmojis.forEach((emoji) => {
    monthCountsByEmoji[emoji] = {};
  });

  const emojiRegex = /\p{Extended_Pictographic}/gu;
  const genderSigns = ['\u2640', '\u2642', '\u2640\uFE0F', '\u2642\uFE0F', '♀', '♂', '♀️', '♂️'];

  messages.forEach((m) => {
    const monthStr = getMonthKey(m.timestamp);
    const emojis = Array.from(m.message.matchAll(emojiRegex), (match) => match[0]);
    emojis.forEach((emoji) => {
      if (genderSigns.includes(emoji)) return;
      if (topEmojis.includes(emoji)) {
        monthCountsByEmoji[emoji][monthStr] = (monthCountsByEmoji[emoji][monthStr] || 0) + 1;
      }
    });
  });

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
    x: bucketDates,
    y: bucketDates.map((d) => monthCountsByEmoji[emoji][getMonthKey(d)] || 0),
    name: emoji,
    type: 'scatter',
    mode: 'lines+markers',
    marker: { color: emojiColors[idx % emojiColors.length] },
    line: { color: emojiColors[idx % emojiColors.length], width: 3 },
    hovertemplate: `${emoji}<br>%{x|%b %Y}<br>%{y} uses<extra></extra>`,
  }));

  const L = getPlotlyLayoutSizes();
  const layout = {
    title: {
      text: 'Top 10 Emojis - Usage Trends Over Time',
      font: { size: L.title },
    },
    margin: { l: L.left, r: 30, t: 100, b: 80 },
    xaxis: {
      title: 'Month',
      type: 'date',
      tickfont: { size: L.tick },
      automargin: true,
    },
    yaxis: {
      title: 'Usage Count',
      tickfont: { size: L.tick },
      automargin: true,
    },
    plot_bgcolor: 'rgba(0,0,0,0)',
    paper_bgcolor: 'rgba(0,0,0,0)',
    width: container.offsetWidth,
    height: getChartHeightPx('medium'),
  };

  Plotly.newPlot(container, traces, layout, getPlotlyConfig());
}
