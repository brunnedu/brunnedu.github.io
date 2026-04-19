import Plotly from 'plotly.js-dist-min';
import { getPlotlyLayoutSizes, getChartHeightPx, getPlotlyConfig } from '../utils';
import { countWordOccurrences } from '../analysis';
import type { ChatMessage } from '../types';

export function renderMostUsedWords(messages: ChatMessage[], container: HTMLElement) {
  container.innerHTML = '';
  const trigramCounts = countWordOccurrences(messages, { ngram: 3 }) as Record<string, number>;
  const data = Object.entries(trigramCounts)
    .map(([trigram, count]) => ({ trigram, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
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
  const L = getPlotlyLayoutSizes();
  const narrow = typeof window !== 'undefined' && window.innerWidth < 600;
  const leftExtra = narrow ? 40 : 60;
  const yTick = narrow ? 13 : 16;
  const layout = {
    title: { text: 'Top 3-Word Sequences', font: { size: L.title } },
    margin: { l: L.left + leftExtra, r: 30, t: 60, b: 60 },
    xaxis: {
      title: 'Count',
      tickfont: { size: L.tick },
      automargin: true,
    },
    yaxis: {
      title: '3-Word Sequence',
      tickfont: { size: yTick },
      automargin: true,
      categoryorder: 'total ascending',
    },
    plot_bgcolor: 'rgba(0,0,0,0)',
    paper_bgcolor: 'rgba(0,0,0,0)',
    showlegend: false,
    width: container.offsetWidth,
    height: Math.max(getChartHeightPx('medium'), data.length * 36 + 120),
  };
  void Plotly.newPlot(container, [trace], layout, getPlotlyConfig());
}

export function renderWordCloud(messages: ChatMessage[], container: HTMLElement) {
  container.innerHTML = '';

  const wordCounts = countWordOccurrences(messages, { skipEmojis: true }) as Record<string, number>;

  const sortedWords = Object.entries(wordCounts)
    .filter(([word, count]) => word.length > 1 && count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 100);

  const words = sortedWords.map(([word]) => word);
  const counts = sortedWords.map(([, count]) => count);
  const totalMessages = messages.length;
  const ratios = counts.map((count) => count / totalMessages);

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

  const L = getPlotlyLayoutSizes();
  const layout = {
    title: { text: 'Word Cloud', font: { size: L.title } },
    xaxis: { showgrid: false, showticklabels: false, zeroline: false },
    yaxis: { showgrid: false, showticklabels: false, zeroline: false },
    margin: { l: L.left, r: 0, t: 80, b: 0 },
    plot_bgcolor: 'rgba(0,0,0,0)',
    paper_bgcolor: 'rgba(0,0,0,0)',
    width: container.offsetWidth,
    height: getChartHeightPx('medium'),
  };

  void Plotly.newPlot(container, [trace], layout, getPlotlyConfig());
}
