import { PLOTLY_TITLE_SIZE, PLOTLY_TICK_FONT_SIZE, PLOTLY_LEFT_MARGIN } from '../utils.js';

export function renderWeeklyHeatmap(messages) {
  const container = document.getElementById('viz-weekly-heatmap');
  container.innerHTML = '';
  const heatmap = Array.from({ length: 24 }, () => Array(7).fill(0));
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  messages.forEach((m) => {
    const date = new Date(m.timestamp);
    const dayIndex = (date.getDay() + 6) % 7;
    const hour = date.getHours();
    heatmap[hour][dayIndex]++;
  });
  const trace = {
    z: heatmap,
    x: days,
    y: Array.from({ length: 24 }, (_, i) => i),
    type: 'heatmap',
    colorscale: 'YlGnBu',
    hoverongaps: false,
    colorbar: { title: 'Messages' },
    hovertemplate: '%{x}, %{y}:00 — %{z} messages<extra></extra>',
  };
  const layout = {
    title: { text: 'Weekly Pattern', font: { size: PLOTLY_TITLE_SIZE } },
    margin: { l: PLOTLY_LEFT_MARGIN, r: 30, t: 60, b: 60 },
    xaxis: {
      title: 'Day',
      tickfont: { size: PLOTLY_TICK_FONT_SIZE },
      automargin: true,
    },
    yaxis: {
      title: 'Hour',
      autorange: 'reversed',
      tickmode: 'array',
      tickvals: [0, 6, 12, 18, 23],
      ticktext: ['00', '06', '12', '18', '23'],
      tickfont: { size: PLOTLY_TICK_FONT_SIZE },
      automargin: true,
    },
    plot_bgcolor: 'rgba(0,0,0,0)',
    paper_bgcolor: 'rgba(0,0,0,0)',
    width: container.offsetWidth,
    height: 420,
  };
  Plotly.newPlot(container, [trace], layout, { responsive: true });
}
