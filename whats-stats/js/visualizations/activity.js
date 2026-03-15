import {
  PLOTLY_TITLE_SIZE,
  PLOTLY_TICK_FONT_SIZE,
  PLOTLY_LEFT_MARGIN,
  getWeekNumber,
  PARTICIPANT_COLORS,
} from '../utils.js';
import { getParticipantsSortedByMessageCount } from '../analysis.js';

export function renderActivityOverTime(messages) {
  const container = document.getElementById('viz-activity-over-time');
  container.innerHTML = '';
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

export function renderActivityOverTimeGrouped(messages) {
  const container = document.getElementById('viz-activity-over-time-grouped');
  container.innerHTML = '';
  const { participants } = getParticipantsSortedByMessageCount(messages);
  const weekCountsByUser = {};
  participants.forEach((user) => {
    weekCountsByUser[user] = {};
  });
  messages.forEach((m) => {
    if (!m.user) return;
    const date = new Date(m.timestamp);
    const year = date.getFullYear();
    const week = getWeekNumber(date);
    const weekStr = `${year}-W${week.toString().padStart(2, '0')}`;
    weekCountsByUser[m.user][weekStr] = (weekCountsByUser[m.user][weekStr] || 0) + 1;
  });
  const allWeeks = Array.from(
    new Set(Object.values(weekCountsByUser).flatMap((obj) => Object.keys(obj)))
  ).sort();
  const traces = participants.map((user, idx) => ({
    x: allWeeks,
    y: allWeeks.map((week) => weekCountsByUser[user][week] || 0),
    name: user,
    type: 'scatter',
    mode: 'lines+markers',
    marker: { color: PARTICIPANT_COLORS[idx % PARTICIPANT_COLORS.length] },
    line: { color: PARTICIPANT_COLORS[idx % PARTICIPANT_COLORS.length], width: 3 },
    hovertemplate: `${user}<br>Week %{x}<br>%{y} messages<extra></extra>`,
  }));
  if (traces.every((t) => t.y.every((y) => y === 0))) {
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
    plot_bgcolor: 'rgba(0,0,0,0)',
    paper_bgcolor: 'rgba(0,0,0,0)',
    width: container.offsetWidth,
    height: 680,
  };
  Plotly.newPlot(container, traces, layout, { responsive: true });
}

export function renderActivityOverTimeStackedPercent(messages) {
  const container = document.getElementById('viz-activity-over-time-stacked-percent');
  container.innerHTML = '';
  const { participants } = getParticipantsSortedByMessageCount(messages, { order: 'asc' });
  const monthCountsByUser = {};
  participants.forEach((user) => {
    monthCountsByUser[user] = {};
  });
  messages.forEach((m) => {
    if (!m.user) return;
    const date = new Date(m.timestamp);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const monthStr = `${year}-${month}`;
    monthCountsByUser[m.user][monthStr] = (monthCountsByUser[m.user][monthStr] || 0) + 1;
  });
  const allMonths = Array.from(
    new Set(Object.values(monthCountsByUser).flatMap((obj) => Object.keys(obj)))
  ).sort();
  const totalPerMonth = allMonths.map((month) =>
    participants.reduce((sum, user) => sum + (monthCountsByUser[user][month] || 0), 0)
  );
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
    marker: { color: PARTICIPANT_COLORS[idx % PARTICIPANT_COLORS.length] },
    line: { width: 0.5 },
    hovertemplate: `${user}<br>Month %{x}<br>%{y:.1f}% of messages<extra></extra>`,
  }));
  if (traces.every((t) => t.y.every((y) => y === 0))) {
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
