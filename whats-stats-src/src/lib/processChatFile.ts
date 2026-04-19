import JSZip from 'jszip';
import { parseWhatsAppChat } from './parser';
import type { ChatMessage } from './types';

const SAMPLE_URL = () => `${import.meta.env.BASE_URL}assets/WhatsApp Chat Sample.txt`;

export async function fetchSampleChat(): Promise<string> {
  const response = await fetch(SAMPLE_URL());
  if (!response.ok) throw new Error('Failed to load sample file');
  return response.text();
}

export function parseChatText(text: string): ChatMessage[] {
  return parseWhatsAppChat(text);
}

export async function readChatFromFile(file: File): Promise<string> {
  const isZip = file.name.toLowerCase().endsWith('.zip');
  const isTxt = file.name.toLowerCase().endsWith('.txt');
  if (!isTxt && !isZip) {
    throw new Error('Please upload a .txt or .zip file exported from WhatsApp.');
  }
  const maxSize = isZip ? 15 * 1024 * 1024 : 5 * 1024 * 1024;
  if (file.size > maxSize) {
    throw new Error(`File is too large. Please upload a file smaller than ${isZip ? '15' : '5'}MB.`);
  }

  if (isZip) {
    const buf = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buf);
    const txtFiles = Object.keys(zip.files).filter(
      (name) => name.toLowerCase().endsWith('.txt') && !zip.files[name].dir
    );
    if (txtFiles.length === 0) {
      throw new Error('No .txt file found inside the zip. Please check your export.');
    }
    const text = await zip.files[txtFiles[0]].async('string');
    return text;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Error reading file. Please try again.'));
    reader.readAsText(file);
  });
}
