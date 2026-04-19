<script lang="ts">
  import { getLongestSilences } from '$lib/silences';
  import { formatDuration, formatDateTimeNoSeconds } from '$lib/utils';
  import type { ChatMessage } from '$lib/types';

  type Props = { messages: ChatMessage[] };
  let { messages }: Props = $props();

  const rows = $derived(getLongestSilences(messages, 5));
</script>

{#if messages.length < 2}
  <p class="viz-empty">Not enough messages to compute silences.</p>
{:else if rows.length === 0}
  <p class="viz-empty">No silences found.</p>
{:else}
  <h4 class="silences-title">Longest silences</h4>
  <div class="table-wrap">
    <table class="silences-table">
      <thead>
        <tr>
          <th>Duration</th>
          <th>Start</th>
          <th>End</th>
          <th>Broken by</th>
        </tr>
      </thead>
      <tbody>
        {#each rows as s}
          <tr>
            <td>{formatDuration(s.duration)}</td>
            <td>{formatDateTimeNoSeconds(s.start)}</td>
            <td>{formatDateTimeNoSeconds(s.end)}</td>
            <td class="breaker">{s.breaker ?? '—'}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
