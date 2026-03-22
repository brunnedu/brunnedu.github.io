import {
  PARTICIPANT_COLORS,
  getPlotlyLayoutSizes,
  getChartHeightPx,
  getPlotlyConfig,
} from '../utils.js';
import { getParticipantsSortedByMessageCount } from '../analysis.js';

export function renderHourlyActivity(messages) {
  const container = document.getElementById('viz-hourly-activity');
  container.innerHTML = '';
  const { participants, totalMessagesByUser } = getParticipantsSortedByMessageCount(messages);
  const hourCountsByUser = {};
  participants.forEach((user) => {
    hourCountsByUser[user] = Array(24).fill(0);
  });
  messages.forEach((m) => {
    if (!m.user) return;
    const hour = new Date(m.timestamp).getHours();
    hourCountsByUser[m.user][hour]++;
  });
  const hourFractionsByUser = {};
  participants.forEach((user) => {
    const total = totalMessagesByUser[user] || 1;
    hourFractionsByUser[user] = hourCountsByUser[user].map((count) => count / total);
  });
  const traces = participants.map((user, idx) => ({
    x: Array.from({ length: 24 }, (_, i) => i),
    y: hourFractionsByUser[user],
    name: user,
    type: 'bar',
    marker: { color: PARTICIPANT_COLORS[idx % PARTICIPANT_COLORS.length] },
    hovertemplate: `${user}<br>Hour %{x}:00<br>%{y:.2f} of messages<extra></extra>`,
  }));
  const L = getPlotlyLayoutSizes();
  const layout = {
    title: {
      text: 'Hourly Activity Distribution by Participant',
      font: { size: L.title },
    },
    margin: { l: L.left, r: 30, t: 100, b: 80 },
    barmode: 'group',
    xaxis: {
      title: 'Hour',
      tickmode: 'array',
      tickvals: [0, 4, 8, 12, 16, 20, 23],
      ticktext: ['0', '4', '8', '12', '16', '20', '23'],
      tickfont: { size: L.tick },
      automargin: true,
    },
    yaxis: {
      title: 'Fraction of Messages',
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

export function renderLongestStreaks(messages) {
  const container = document.getElementById('viz-longest-streaks');
  container.innerHTML = '';

  const { participants } = getParticipantsSortedByMessageCount(messages);
  const streaks = participants.map((user) => {
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

  streaks.sort((a, b) => b.maxStreak - a.maxStreak);

  const users = streaks.map((s) => s.user).reverse();
  const maxStreaks = streaks.map((s) => s.maxStreak).reverse();
  const texts = streaks
    .map((s) => (s.maxStreak > 0 ? `${s.maxStart} → ${s.maxEnd}` : 'No streak'))
    .reverse();
  const colors = streaks
    .map((_, idx) => PARTICIPANT_COLORS[idx % PARTICIPANT_COLORS.length])
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

  const L = getPlotlyLayoutSizes();
  const dynamicH = 200 + streaks.length * 30;
  const layout = {
    title: {
      text: 'Longest Streak by Participant (Consecutive Days with Messages)',
      font: { size: L.title },
    },
    margin: { l: L.left, r: 30, t: 100, b: 60 },
    xaxis: {
      title: 'Longest Streak (days)',
      tickfont: { size: L.tick },
      automargin: true,
    },
    yaxis: {
      title: 'Participant',
      tickfont: { size: L.tick },
      automargin: true,
    },
    plot_bgcolor: 'rgba(0,0,0,0)',
    paper_bgcolor: 'rgba(0,0,0,0)',
    width: container.offsetWidth,
    height: Math.max(getChartHeightPx('medium'), Math.min(dynamicH, getChartHeightPx('large') * 1.5)),
  };

  Plotly.newPlot(container, traces, layout, getPlotlyConfig());
}
