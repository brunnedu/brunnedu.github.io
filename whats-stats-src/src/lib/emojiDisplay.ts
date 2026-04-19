/**
 * WhatsApp / export text often uses legacy dingbats without VS16 (U+FE0F), so they render as
 * monochrome text glyphs. Prefer emoji presentation when the platform has a color glyph.
 *
 * Use for display only — keep counting/map keys on original strings from the chat.
 */

const LEGACY_EMOJI_CODEPOINTS = new Set([
  0x2639, // ☹
  0x263a, // ☺
  0x2665, // ♥
  0x2660, 0x2663, 0x2666,
  0x2600, 0x2601, 0x2602, 0x2603,
  0x260e,
  0x2614, 0x2615,
  0x2648, 0x2649, 0x264a, 0x264b, 0x264c, 0x264d, 0x264e, 0x264f,
  0x2650, 0x2651, 0x2652, 0x2653,
]);

export function withVariationSelector(emoji: string): string {
  if (!emoji) return emoji;
  if (emoji === '☺') return '\u263A\uFE0F';
  if (emoji === '♥') return '\u2665\uFE0F';
  if (emoji === '☹') return '\u2639\uFE0F';

  const segment = emoji.trim();
  if (segment.includes('\uFE0F')) return emoji;

  const cp = segment.codePointAt(0);
  if (cp === undefined) return emoji;

  const units = cp > 0xffff ? 2 : 1;
  if (segment.length !== units) {
    return emoji;
  }

  if (LEGACY_EMOJI_CODEPOINTS.has(cp)) {
    return segment + '\uFE0F';
  }

  return emoji;
}

/** Stack for Plotly `font.family` (Plotly expects a comma-separated string). */
export const PLOTLY_EMOJI_FONT_FAMILY =
  "Inter, 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'Twemoji Mozilla', 'Noto Emoji', sans-serif";
