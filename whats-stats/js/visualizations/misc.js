import {
  formatDuration,
  formatDateTimeNoSeconds,
  getPlotlyLayoutSizes,
  getChartHeightPx,
  getPlotlyConfig,
} from '../utils.js';

export function renderMessageLengthHistogram(messages) {
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
  const L = getPlotlyLayoutSizes();
  const layout = {
    title: { text: 'Message Lengths', font: { size: L.title } },
    margin: { l: L.left, r: 30, t: 60, b: 60 },
    xaxis: {
      title: 'Length (characters)',
      tickfont: { size: L.tick },
      automargin: true,
    },
    yaxis: {
      title: 'Messages',
      tickfont: { size: L.tick },
      automargin: true,
      type: 'log',
    },
    plot_bgcolor: 'rgba(0,0,0,0)',
    paper_bgcolor: 'rgba(0,0,0,0)',
    showlegend: false,
    width: container.offsetWidth,
    height: getChartHeightPx('small'),
  };
  Plotly.newPlot(container, [trace], layout, getPlotlyConfig());
}

export function renderLongestSilences(messages) {
  const container = document.getElementById('viz-longest-silences');
  container.innerHTML = '';
  if (!messages || messages.length < 2) {
    container.textContent = 'Not enough messages to compute silences.';
    return;
  }
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
  const topSilences = silences.sort((a, b) => b.duration - a.duration).slice(0, 5);
  if (topSilences.length === 0) {
    container.textContent = 'No silences found.';
    return;
  }
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
          <td style="padding:0.4em 0.7em; text-align:center;">${formatDateTimeNoSeconds(s.start)}</td>
          <td style="padding:0.4em 0.7em; text-align:center;">${formatDateTimeNoSeconds(s.end)}</td>
          <td style="padding:0.4em 0.7em; color:#2a6ebb; font-weight:600; text-align:center;">${s.breaker}</td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  `;
  const title = document.createElement('h4');
  title.textContent = 'Longest Silences';
  container.appendChild(title);
  container.appendChild(table);
}
