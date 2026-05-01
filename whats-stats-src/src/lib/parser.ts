import type { ChatMessage } from './types';
type DateOrder = 'dmy' | 'mdy';

function parseTimeToIso(time: string): string {
  const normalized = time.trim().replace(/\./g, '').toLowerCase();
  const ampmMatch = normalized.match(/\s*(am|pm)$/);
  const core = ampmMatch ? normalized.replace(/\s*(am|pm)$/, '') : normalized;
  const parts = core.split(':');
  let hh = Number(parts[0] || 0);
  const mm = Number(parts[1] || 0);
  const ss = Number(parts[2] || 0);

  if (ampmMatch) {
    const ampm = ampmMatch[1];
    if (ampm === 'am' && hh === 12) hh = 0;
    else if (ampm === 'pm' && hh < 12) hh += 12;
  }

  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

function buildValidatedLocalDate(year: number, month: number, day: number, timeIso: string): Date | null {
  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${timeIso}`;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  if (d.getFullYear() !== year || d.getMonth() + 1 !== month || d.getDate() !== day) return null;
  return d;
}

function parseDateTime(date: string, time: string, preferredOrder: DateOrder = 'dmy'): string {
  const dateParts = date.split(/[\/\.\-]/).map((s) => s.trim());
  const timeIso = parseTimeToIso(time);

  if (dateParts.length !== 3) {
    const fallback = new Date(`${date}T${timeIso}`);
    if (!Number.isFinite(fallback.getTime())) throw new Error('Invalid time value');
    return fallback.toISOString();
  }

  if (dateParts[0].length === 4) {
    const year = Number(dateParts[0]);
    const month = Number(dateParts[1]);
    const day = Number(dateParts[2]);
    const d = buildValidatedLocalDate(year, month, day, timeIso);
    if (!d) throw new Error('Invalid time value');
    return d.toISOString();
  }

  const a = Number(dateParts[0]);
  const b = Number(dateParts[1]);
  const rawYear = Number(dateParts[2]);
  const year = dateParts[2].length === 2 ? 2000 + rawYear : rawYear;

  let candidates: Array<{ month: number; day: number }> = [];
  if (date.includes('.')) {
    // Dot-separated exports are typically DD.MM.YYYY.
    candidates = [
      { month: b, day: a },
      { month: a, day: b },
    ];
  } else if (a > 12 && b <= 12) {
    // Definitely DD/MM/YYYY.
    candidates = [{ month: b, day: a }];
  } else if (b > 12 && a <= 12) {
    // Definitely MM/DD/YYYY.
    candidates = [{ month: a, day: b }];
  } else {
    // Ambiguous dates: file-level preference; default is DD/MM (dmy) when unclear.
    if (preferredOrder === 'mdy') {
      candidates = [
        { month: a, day: b },
        { month: b, day: a },
      ];
    } else {
      candidates = [
        { month: b, day: a },
        { month: a, day: b },
      ];
    }
  }

  for (const c of candidates) {
    const d = buildValidatedLocalDate(year, c.month, c.day, timeIso);
    if (d) return d.toISOString();
  }

  throw new Error('Invalid time value');
}

const LEADING_MESSAGE_MARKS = /^[\u200E\u200F\uFEFF\uFFFC\u200B\u200C\u200D]+/g;

function stripLeadingMessageArtifacts(message: string): string {
  return message.replace(LEADING_MESSAGE_MARKS, '').trim();
}

type HeaderMatch = { index: number; full: string; date: string; time: string };

function buildHeaderMatches(text: string): HeaderMatch[] {
  const iosRe =
    /\[(?<date>\d{1,4}[\/\.\-]\d{1,2}[\/\.\-]\d{1,4}),\ (?<time>\d{1,2}:\d{2}(?::\d{2})?(?:\s?[APap][Mm])?)\]\ /g;
  const androidRe =
    /(?<date>\d{1,4}[\/\.\-]\d{1,2}[\/\.\-]\d{1,4}),\ (?<time>\d{1,2}:\d{2}(?::\d{2})?(?:\s?[APap][Mm])?)\ [\-\u2013]\ /g;
  const matches: HeaderMatch[] = [];
  for (const m of text.matchAll(iosRe)) {
    if (m.groups?.date && m.groups?.time) {
      matches.push({ index: m.index!, full: m[0], date: m.groups.date, time: m.groups.time });
    }
  }
  for (const m of text.matchAll(androidRe)) {
    if (m.groups?.date && m.groups?.time) {
      matches.push({ index: m.index!, full: m[0], date: m.groups.date, time: m.groups.time });
    }
  }
  matches.sort((a, b) => a.index - b.index);
  return matches;
}

function detectPreferredDateOrder(headerMatches: HeaderMatch[]): DateOrder {
  let dmyVotes = 0;
  let mdyVotes = 0;

  for (const h of headerMatches) {
    if (h.date.includes('.')) continue;
    const parts = h.date.split(/[\/\-]/).map((s) => s.trim());
    if (parts.length !== 3) continue;
    if (parts[0].length === 4) continue;
    const a = Number(parts[0]);
    const b = Number(parts[1]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    if (a > 12 && b <= 12) dmyVotes += 1;
    else if (b > 12 && a <= 12) mdyVotes += 1;
  }

  if (mdyVotes > dmyVotes) return 'mdy';
  // Tie or no unambiguous votes: assume DD/MM (common for WhatsApp exports outside US).
  return 'dmy';
}

export function parseWhatsAppChat(text: string): ChatMessage[] {
  const unwantedCharsRegex =
    /[\u200B\u200C\u200D\u202A\u202B\u202C\u202D\u202E\u200E\u200F\u00AD]/g;

  text = text.replace(unwantedCharsRegex, '');
  text = text.normalize('NFKD');

  const headerMatches = buildHeaderMatches(text);
  const preferredOrder = detectPreferredDateOrder(headerMatches);
  const messages: ChatMessage[] = [];

  for (let i = 0; i < headerMatches.length; i++) {
    const current = headerMatches[i];
    const next = headerMatches[i + 1];

    const startIndex = current.index + current.full.length;
    const endIndex = next ? next.index : text.length;

    let rawMessage = text.slice(startIndex, endIndex).trim();

    let user: string | null = null;
    let message = rawMessage;

    const colonIndex = rawMessage.indexOf(':');
    if (colonIndex !== -1) {
      const possibleUser = rawMessage.slice(0, colonIndex).trim();
      const possibleMsg = rawMessage.slice(colonIndex + 1).trim();

      if (possibleUser.length > 0 && !possibleUser.includes('\n')) {
        user = possibleUser;
        message = possibleMsg;
      }
    }

    message = stripLeadingMessageArtifacts(message);

    let timestamp: string;
    try {
      timestamp = parseDateTime(current.date, current.time, preferredOrder);
    } catch {
      // Skip malformed entries instead of failing the whole import.
      continue;
    }

    messages.push({
      timestamp,
      user,
      message,
    });
  }

  return messages;
}
