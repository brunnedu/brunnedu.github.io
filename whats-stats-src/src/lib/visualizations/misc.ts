import Plotly from 'plotly.js-dist-min';
import { getPlotlyLayoutSizes, getChartHeightPx, getPlotlyConfig } from '../utils';
import type { ChatMessage } from '../types';

export function renderMessageLengthHistogram(messages: ChatMessage[], container: HTMLElement) {
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
  void Plotly.newPlot(container, [trace], layout, getPlotlyConfig());
}
