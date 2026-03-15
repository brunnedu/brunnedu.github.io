// Parse date and time to ISO string
function parseDateTime(date, time) {
  let d, parts;
  if (date.includes('/')) {
    parts = date.split('/');
    const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
    d = new Date(`${year}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}T${time}`);
  } else if (date.includes('.')) {
    parts = date.split('.');
    const year = parts[2].length === 2 ? '20' + parts[2] : parts[2];
    d = new Date(`${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}T${time}`);
  } else {
    d = new Date(date + 'T' + time);
  }
  return d.toISOString();
}

export function parseWhatsAppChat(text) {
  const unwantedCharsRegex =
    /[\u200B\u200C\u200D\u202A\u202B\u202C\u202D\u202E\u200E\u200F\u00AD]/g;

  const headerRegex =
    /(?<full>(?<date>\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4}), (?<time>\d{1,2}:\d{2}) [\-\u2013] )/g;

  text = text.replace(unwantedCharsRegex, '');
  text = text.normalize('NFKD');

  const matches = [...text.matchAll(headerRegex)];
  const messages = [];

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];

    const result = current.groups;
    const startIndex = current.index + current.groups.full.length;
    const endIndex = next ? next.index : text.length;

    let rawMessage = text.slice(startIndex, endIndex).trim();

    let user = null;
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

    const timestamp = parseDateTime(result.date, result.time);

    messages.push({
      timestamp,
      user,
      message,
    });
  }

  return messages;
}

export function decryptChat(cipherText, password) {
  try {
    const bytes = CryptoJS.AES.decrypt(cipherText, password);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (!decrypted) throw new Error('Invalid password or corrupted file');
    return decrypted;
  } catch (e) {
    return null;
  }
}
