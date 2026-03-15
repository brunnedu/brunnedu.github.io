import { showVizError } from '../utils.js';
import { renderActivityOverTime } from './activity.js';
import { renderActivityOverTimeGrouped, renderActivityOverTimeStackedPercent } from './activity.js';
import { renderWeeklyHeatmap } from './heatmap.js';
import { renderEmojiChart, renderEmojiTrends } from './emoji.js';
import { renderMostUsedWords, renderWordCloud } from './words.js';
import { renderHourlyActivity, renderLongestStreaks } from './participant.js';
import { renderMessageLengthHistogram, renderLongestSilences } from './misc.js';

const VIZ_RENDERERS = [
  ['viz-activity-over-time', renderActivityOverTime],
  ['viz-hourly-activity', renderHourlyActivity],
  ['viz-longest-streaks', renderLongestStreaks],
  ['viz-weekly-heatmap', renderWeeklyHeatmap],
  ['viz-emojis', renderEmojiChart],
  ['viz-emoji-trends', renderEmojiTrends],
  ['viz-most-used-words', renderMostUsedWords],
  ['viz-activity-over-time-grouped', renderActivityOverTimeGrouped],
  ['viz-activity-over-time-stacked-percent', renderActivityOverTimeStackedPercent],
  ['viz-message-length-histogram', renderMessageLengthHistogram],
  ['viz-longest-silences', renderLongestSilences],
  ['viz-word-cloud', renderWordCloud],
];

export function runAllVisualizations(messages) {
  VIZ_RENDERERS.forEach(([containerId, render]) => {
    try {
      render(messages);
    } catch (err) {
      showVizError(containerId, err);
    }
  });
}
