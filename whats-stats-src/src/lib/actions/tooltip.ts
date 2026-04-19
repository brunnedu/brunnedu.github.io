import type { Action } from 'svelte/action';

const SHOW_MS = 200;
const OFFSET = 12;
const VIEW_PAD = 8;
const MAX_TEXT = 2000;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function placeTip(tip: HTMLElement, clientX: number, clientY: number) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  tip.style.left = '0';
  tip.style.top = '0';
  const { width: w, height: h } = tip.getBoundingClientRect();
  let x = clientX + OFFSET;
  let y = clientY + OFFSET;
  if (x + w + VIEW_PAD > vw) x = clientX - w - OFFSET;
  if (y + h + VIEW_PAD > vh) y = clientY - h - OFFSET;
  x = clamp(x, VIEW_PAD, vw - w - VIEW_PAD);
  y = clamp(y, VIEW_PAD, vh - h - VIEW_PAD);
  tip.style.left = `${Math.round(x)}px`;
  tip.style.top = `${Math.round(y)}px`;
}

/**
 * Hover tooltip with a fixed 200ms show delay. Pass empty / null / undefined to disable.
 */
export const tooltip: Action<HTMLElement, string | null | undefined> = (node, initial) => {
  let content: string | null | undefined = initial;
  let tip: HTMLDivElement | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let active = false;
  let lastX = 0;
  let lastY = 0;

  function removeTip() {
    tip?.remove();
    tip = null;
  }

  function show() {
    const t = content?.trim();
    if (!t || !active) return;
    removeTip();
    const el = document.createElement('div');
    el.className = 'app-tooltip';
    el.setAttribute('role', 'tooltip');
    const body = t.length > MAX_TEXT ? `${t.slice(0, MAX_TEXT)}…` : t;
    el.textContent = body;
    document.body.appendChild(el);
    tip = el;
    placeTip(el, lastX, lastY);
  }

  function onEnter(e: MouseEvent) {
    active = true;
    lastX = e.clientX;
    lastY = e.clientY;
    if (timer) clearTimeout(timer);
    if (!content?.trim()) return;
    timer = setTimeout(() => {
      timer = null;
      if (active) show();
    }, SHOW_MS);
  }

  function onMove(e: MouseEvent) {
    lastX = e.clientX;
    lastY = e.clientY;
    if (tip) placeTip(tip, lastX, lastY);
  }

  function onLeave() {
    active = false;
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    removeTip();
  }

  node.addEventListener('mouseenter', onEnter);
  node.addEventListener('mousemove', onMove);
  node.addEventListener('mouseleave', onLeave);

  return {
    update(newText: string | null | undefined) {
      content = newText;
      if (!content?.trim()) {
        onLeave();
      }
    },
    destroy() {
      onLeave();
      node.removeEventListener('mouseenter', onEnter);
      node.removeEventListener('mousemove', onMove);
      node.removeEventListener('mouseleave', onLeave);
    },
  };
};
