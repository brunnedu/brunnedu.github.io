import type { ChatMessage } from './types';

function parseDateTime(date: string, time: string): string {
  let d: Date;
  const parts = time.split(':');
  const hh = parts[0].padStart(2, '0');
  const mm = (parts[1] || '0').padStart(2, '0');
  const ss = parts[2] != null ? parts[2].padStart(2, '0') : '00';
  const timeIso = `${hh}:${mm}:${ss}`;

  if (date.includes('/')) {
    const p = date.split('/');
    const year = p[2].length === 2 ? '20' + p[2] : p[2];
    d = new Date(`${year}-${p[0].padStart(2, '0')}-${p[1].padStart(2, '0')}T${timeIso}`);
  } else if (date.includes('.')) {
    const p = date.split('.');
    const year = p[2].length === 2 ? '20' + p[2] : p[2];
    d = new Date(`${year}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}T${timeIso}`);
  } else {
    d = new Date(`${date}T${timeIso}`);
  }
  return d.toISOString();
}

const LEADING_MESSAGE_MARKS = /^[\u200E\u200F\uFEFF\uFFFC\u200B\u200C\u200D]+/g;

function stripLeadingMessageArtifacts(message: string): string {
  return message.replace(LEADING_MESSAGE_MARKS, '').trim();
}

type HeaderMatch = { index: number; full: string; date: string; time: string };

function buildHeaderMatches(text: string): HeaderMatch[] {
  const iosRe =
    /\[(?<date>\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4}),\ (?<time>\d{1,2}:\d{2}(?::\d{2})?)\]\ /g;
  const androidRe =
    /(?<date>\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4}),\ (?<time>\d{1,2}:\d{2}(?::\d{2})?)\ [\-\u2013]\ /g;
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

export function parseWhatsAppChat(text: string): ChatMessage[] {
  const unwantedCharsRegex =
    /[\u200B\u200C\u200D\u202A\u202B\u202C\u202D\u202E\u200E\u200F\u00AD]/g;

  text = text.replace(unwantedCharsRegex, '');
  text = text.normalize('NFKD');

  const headerMatches = buildHeaderMatches(text);
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

    const timestamp = parseDateTime(current.date, current.time);

    messages.push({
      timestamp,
      user,
      message,
    });
  }

  return messages;
}
