import Plotly from 'plotly.js-dist-min';
import {
  MIN_COLUMN_FOLLOW_EVENTS,
  MIN_EDGE_FOLLOW_EVENTS,
  MIN_MESSAGES_FROM_SOURCE,
  computeFollowMatrix,
} from '../followWho';
import { formatDuration, getPlotlyLayoutSizes, getChartHeightPx, getPlotlyConfig } from '../utils';
import type { ChatMessage } from '../types';

export function renderWhoFollowsWhomHeatmap(messages: ChatMessage[], container: HTMLElement) {
  container.innerHTML = '';
  const result = computeFollowMatrix(messages);
  if (!result) {
    container.textContent = 'Need at least two participants to chart who follows whom.';
    container.style.color = 'var(--text-muted)';
    return;
  }

  const { participants, raw, z, timing, colIncluded, colSums } = result;
  if (!colIncluded.some(Boolean)) {
    container.textContent =
      'Not enough follow events to draw this chart (each person needs at least ' +
      MIN_MESSAGES_FROM_SOURCE +
      ' messages and at least ' +
      MIN_COLUMN_FOLLOW_EVENTS +
      ' times they were the first quick responder after someone else).';
    container.style.color = 'var(--text-muted)';
    return;
  }

  const zPlot: (number | null)[][] = z.map((row) =>
    row.map((cell) => (cell === null ? NaN : cell))
  );

  const text = z.map((row, i) =>
    row.map((cell, j) => {
      if (i === j) return '—';
      const r = raw[i]![j]!;
      if (r === 0) return '';
      const pct = cell !== null && Number.isFinite(cell) ? `${(cell * 100).toFixed(0)}%` : '';
      const low = r < MIN_EDGE_FOLLOW_EVENTS ? ' *' : '';
      return `${r}${low}\n${pct}`.trim();
    })
  );

  const customdata = raw.map((row, i) =>
    row.map((r, j) => {
      if (i === j) return '';
      const csum = colSums[j] ?? 0;
      const share = csum > 0 ? ((r / csum) * 100).toFixed(1) : '0';
      const after = participants[i];
      const responder = participants[j];
      return `${r} follow · ${share}% of ${responder}’s first quick replies were right after ${after}`;
    })
  );

  const finiteZ = zPlot.flat().filter((v) => Number.isFinite(v) && v > 0);
  const maxZ = finiteZ.length ? Math.max(...finiteZ) : 0.25;
  /** Stretch color scale when most shares are well below 100%. */
  const zmaxViz = Math.min(0.55, Math.max(0.18, maxZ * 1.25));

  const trace = {
    z: zPlot,
    x: participants,
    y: participants,
    text,
    customdata,
    type: 'heatmap',
    colorscale: [
      [0, '#f4f8fc'],
      [0.12, '#dceaf7'],
      [0.28, '#a8cce8'],
      [0.48, '#5a9fd4'],
      [0.72, '#2a6ebb'],
      [1, '#0d3a62'],
    ],
    zmin: 0,
    zmax: zmaxViz,
    hoverongaps: false,
    colorbar: {
      title: '% of that person’s first replies',
      titleside: 'right',
      tickformat: ',.0%',
    },
    hovertemplate:
      '<b>After %{y}, %{x} spoke first</b><br>%{customdata}<br><extra></extra>',
  };

  const L = getPlotlyLayoutSizes();
  const layout = {
    title: {
      text: 'Who speaks first after whom',
      font: { size: L.title },
    },
    margin: { l: L.left, r: 90, t: 70, b: 80 },
    xaxis: {
      title: `First to reply (within ${formatDuration(timing.responseWindowMs)})`,
      tickangle: -35,
      tickfont: { size: L.tick },
      automargin: true,
    },
    yaxis: {
      title: 'Right after a message from',
      autorange: 'reversed',
      tickfont: { size: L.tick },
      automargin: true,
    },
    plot_bgcolor: 'rgba(0,0,0,0)',
    paper_bgcolor: 'rgba(0,0,0,0)',
    width: container.offsetWidth,
    height: getChartHeightPx('large'),
  };

  const note = document.createElement('p');
  note.className = 'viz-follow-note';
  const windowStr = formatDuration(timing.responseWindowMs);
  note.innerHTML = [
    `Row = who just messaged; column = who replied first within <strong>${windowStr}</strong>. Color = share of that person’s first replies in that window after each row. <em>*</em> = few events; not real reply threads.`,
  ].join('');

  void Plotly.newPlot(container, [trace], layout, getPlotlyConfig()).then(() => {
    container.appendChild(note);
  });
}
