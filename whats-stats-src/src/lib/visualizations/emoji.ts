import Plotly from 'plotly.js-dist-min';
import {
  getTimeRangeFromMessages,
  generateMonthlyBuckets,
  getMonthKey,
  getPlotlyLayoutSizes,
  getChartHeightPx,
  getPlotlyConfig,
} from '../utils';
import { countEmojiOccurrences } from '../analysis';
import type { ChatMessage } from '../types';
import { PLOTLY_EMOJI_FONT_FAMILY, withVariationSelector } from '../emojiDisplay';

export function renderEmojiChart(messages: ChatMessage[], container: HTMLElement) {
  container.innerHTML = '';
  const emojiCounts = countEmojiOccurrences(messages) as Record<string, number>;
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
    font: { family: PLOTLY_EMOJI_FONT_FAMILY },
    title: { text: 'Most Used Emojis', font: { size: L.title, family: PLOTLY_EMOJI_FONT_FAMILY } },
    margin: { l: L.left, r: 30, t: 60, b: 80 },
    xaxis: {
      title: 'Emoji',
      tickfont: { size: emojiTick, family: PLOTLY_EMOJI_FONT_FAMILY },
      automargin: true,
    },
    yaxis: {
      title: 'Count',
      tickfont: { size: L.tick, family: PLOTLY_EMOJI_FONT_FAMILY },
      automargin: true,
    },
    plot_bgcolor: 'rgba(0,0,0,0)',
    paper_bgcolor: 'rgba(0,0,0,0)',
    showlegend: false,
    width: container.offsetWidth,
    height: getChartHeightPx('small'),
  };
  void Plotly.newPlot(container, [trace], layout, getPlotlyConfig());
}

export function renderEmojiTrends(messages: ChatMessage[], container: HTMLElement) {
  container.innerHTML = '';

  const emojiCounts = countEmojiOccurrences(messages) as Record<string, number>;
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
  const monthCountsByEmoji: Record<string, Record<string, number>> = {};
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

  const traces = topEmojis.map((emoji, idx) => {
    const display = withVariationSelector(emoji);
    return {
      x: bucketDates,
      y: bucketDates.map((d) => monthCountsByEmoji[emoji][getMonthKey(d)] || 0),
      name: display,
      type: 'scatter',
      mode: 'lines+markers',
      marker: { color: emojiColors[idx % emojiColors.length] },
      line: { color: emojiColors[idx % emojiColors.length], width: 3 },
      hovertemplate: `${display}<br>%{x|%b %Y}<br>%{y} uses<extra></extra>`,
    };
  });

  const L = getPlotlyLayoutSizes();
  const layout = {
    font: { family: PLOTLY_EMOJI_FONT_FAMILY },
    title: {
      text: 'Top 10 Emojis - Usage Trends Over Time',
      font: { size: L.title, family: PLOTLY_EMOJI_FONT_FAMILY },
    },
    margin: { l: L.left, r: 30, t: 100, b: 80 },
    xaxis: {
      title: 'Month',
      type: 'date',
      tickfont: { size: L.tick, family: PLOTLY_EMOJI_FONT_FAMILY },
      automargin: true,
    },
    yaxis: {
      title: 'Usage Count',
      tickfont: { size: L.tick, family: PLOTLY_EMOJI_FONT_FAMILY },
      automargin: true,
    },
    legend: {
      font: { family: PLOTLY_EMOJI_FONT_FAMILY, size: L.tick },
    },
    plot_bgcolor: 'rgba(0,0,0,0)',
    paper_bgcolor: 'rgba(0,0,0,0)',
    width: container.offsetWidth,
    height: getChartHeightPx('medium'),
  };

  void Plotly.newPlot(container, traces, layout, getPlotlyConfig());
}
