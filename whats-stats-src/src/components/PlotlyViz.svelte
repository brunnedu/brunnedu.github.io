<script lang="ts">
  import type { ChatMessage } from '$lib/types';
  import Plotly from 'plotly.js-dist-min';

  type Props = {
    messages: ChatMessage[];
    render: (messages: ChatMessage[], el: HTMLElement) => void;
    viewport: number;
  };

  let { messages, render, viewport }: Props = $props();

  let host = $state<HTMLElement | null>(null);

  $effect(() => {
    viewport;
    const el = host;
    if (!el) return;

    const cleanup = () => {
      try {
        Plotly.purge(el);
      } catch {
        /* ignore */
      }
    };

    cleanup();
    if (messages.length === 0) {
      el.innerHTML = '';
      return cleanup;
    }

    try {
      render(messages, el);
    } catch (e) {
      el.innerHTML = '';
      el.textContent = 'Error: ' + (e instanceof Error ? e.message : String(e));
      el.style.color = '#e74c3c';
      el.style.fontWeight = '600';
    }

    return cleanup;
  });
</script>

<div class="viz-host" bind:this={host}></div>
