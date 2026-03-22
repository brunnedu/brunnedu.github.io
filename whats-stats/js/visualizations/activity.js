import {
  PARTICIPANT_COLORS,
  getTimeRangeFromMessages,
  generateMonthlyBuckets,
  aggregateMessagesByMonth,
  getPlotlyLayoutSizes,
  getChartHeightPx,
  getPlotlyConfig,
} from '../utils.js';
import { getParticipantsSortedByMessageCount } from '../analysis.js';

export function renderActivityOverTime(messages) {
  const container = document.getElementById('viz-activity-over-time');
  container.innerHTML = '';
  const { minDate, maxDate } = getTimeRangeFromMessages(messages);
  if (!minDate || !maxDate) {
    container.textContent = 'No data to display.';
    return;
  }
  const bucketDates = generateMonthlyBuckets(minDate, maxDate);
  const { counts } = aggregateMessagesByMonth(messages, bucketDates);
  const trace = {
    x: bucketDates,
    y: counts,
    type: 'scatter',
    mode: 'lines+markers',
    marker: { color: '#2a6ebb' },
    line: { color: '#2a6ebb', width: 3 },
    hovertemplate: '%{x|%b %Y}<br>%{y} messages<extra></extra>',
  };
  const L = getPlotlyLayoutSizes();
  const layout = {
    title: { text: 'Messages Over Time', font: { size: L.title } },
    margin: { l: L.left, r: 30, t: 60, b: 60 },
    xaxis: {
      title: 'Month',
      type: 'date',
      tickfont: { size: L.tick },
      automargin: true,
    },
    yaxis: {
      title: 'Messages',
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

export function renderActivityOverTimeGrouped(messages) {
  const container = document.getElementById('viz-activity-over-time-grouped');
  container.innerHTML = '';
  const { minDate, maxDate } = getTimeRangeFromMessages(messages);
  if (!minDate || !maxDate) {
    container.textContent = 'No data to display.';
    return;
  }
  const bucketDates = generateMonthlyBuckets(minDate, maxDate);
  const { participants } = getParticipantsSortedByMessageCount(messages);
  const { byUser } = aggregateMessagesByMonth(messages, bucketDates, { byParticipant: true });
  const traces = participants.map((user, idx) => ({
    x: bucketDates,
    y: (byUser[user] || bucketDates.map(() => 0)),
    name: user,
    type: 'scatter',
    mode: 'lines+markers',
    marker: { color: PARTICIPANT_COLORS[idx % PARTICIPANT_COLORS.length] },
    line: { color: PARTICIPANT_COLORS[idx % PARTICIPANT_COLORS.length], width: 3 },
    hovertemplate: `${user}<br>%{x|%b %Y}<br>%{y} messages<extra></extra>`,
  }));
  if (traces.every((t) => t.y.every((y) => y === 0))) {
    container.textContent = 'No data to display.';
    return;
  }
  const L = getPlotlyLayoutSizes();
  const layout = {
    title: {
      text: 'Message Activity Over Time (Grouped by Participant, per Month)',
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
      title: 'Messages per Month',
      tickfont: { size: L.tick },
      automargin: true,
    },
    plot_bgcolor: 'rgba(0,0,0,0)',
    paper_bgcolor: 'rgba(0,0,0,0)',
    width: container.offsetWidth,
    height: getChartHeightPx('large'),
  };
  Plotly.newPlot(container, traces, layout, getPlotlyConfig());
}

export function renderActivityOverTimeStackedPercent(messages) {
  const container = document.getElementById('viz-activity-over-time-stacked-percent');
  container.innerHTML = '';
  const { minDate, maxDate } = getTimeRangeFromMessages(messages);
  if (!minDate || !maxDate) {
    container.textContent = 'No data to display.';
    return;
  }
  const bucketDates = generateMonthlyBuckets(minDate, maxDate);
  const { participants } = getParticipantsSortedByMessageCount(messages, { order: 'asc' });
  const { byUser } = aggregateMessagesByMonth(messages, bucketDates, { byParticipant: true });
  const totalPerMonth = bucketDates.map((_, i) =>
    participants.reduce((sum, user) => sum + ((byUser[user] || [])[i] || 0), 0)
  );
  const traces = participants.map((user, idx) => ({
    x: bucketDates,
    y: bucketDates.map((_, i) => {
      const count = (byUser[user] || [])[i] || 0;
      const total = totalPerMonth[i] || 1;
      return (count / total) * 100;
    }),
    name: user,
    type: 'scatter',
    mode: 'lines',
    stackgroup: 'one',
    groupnorm: 'percent',
    marker: { color: PARTICIPANT_COLORS[idx % PARTICIPANT_COLORS.length] },
    line: { width: 0.5 },
    hovertemplate: `${user}<br>%{x|%b %Y}<br>%{y:.1f}% of messages<extra></extra>`,
  }));
  if (traces.every((t) => t.y.every((y) => y === 0))) {
    container.textContent = 'No data to display.';
    return;
  }
  const L = getPlotlyLayoutSizes();
  const layout = {
    title: {
      text: 'Message Activity Over Time (Stacked Area, % by Participant, per Month)',
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
      title: 'Share of Messages (%)',
      tickfont: { size: L.tick },
      automargin: true,
      range: [0, 100],
    },
    plot_bgcolor: 'rgba(0,0,0,0)',
    paper_bgcolor: 'rgba(0,0,0,0)',
    width: container.offsetWidth,
    height: getChartHeightPx('large'),
  };
  Plotly.newPlot(container, traces, layout, getPlotlyConfig());
}
