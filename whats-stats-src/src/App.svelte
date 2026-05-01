<script lang="ts">
  import { onMount } from 'svelte';
  import PlotlyViz from './components/PlotlyViz.svelte';
  import LongestSilencesTable from './components/LongestSilencesTable.svelte';
  import { buildParticipantStats, getSummaryCards, gapTitle } from '$lib/summary';
  import { formatDuration } from '$lib/utils';
  import { fetchSampleChat, readChatFromFile, parseChatText } from '$lib/processChatFile';
  import { renderActivityOverTime, renderActivityOverTimeGrouped, renderActivityOverTimeStackedPercent } from '$lib/visualizations/activity';
  import { renderWeeklyHeatmap } from '$lib/visualizations/heatmap';
  import { renderEmojiChart, renderEmojiTrends } from '$lib/visualizations/emoji';
  import { renderMostUsedWords, renderWordCloud } from '$lib/visualizations/words';
  import { renderHourlyActivity, renderLongestStreaks } from '$lib/visualizations/participant';
  import { renderWhoFollowsWhomHeatmap } from '$lib/visualizations/followHeatmap';
  import { renderMessageLengthHistogram } from '$lib/visualizations/misc';
  import type { ChatMessage } from '$lib/types';
  import { tooltip } from '$lib/actions/tooltip';
  import { withVariationSelector } from '$lib/emojiDisplay';

  const base = import.meta.env.BASE_URL;

  let viewport = $state(0);
  let messages = $state<ChatMessage[] | null>(null);
  let status = $state<{ text: string; ok: boolean } | null>(null);
  let busy = $state(false);
  let dragOver = $state(false);
  let instructionTab = $state<'android' | 'iphone'>('android');

  let fileInput: HTMLInputElement | null = $state(null);

  const hasData = $derived(messages !== null && messages.length > 0);
  const summaryCards = $derived(messages && messages.length ? getSummaryCards(messages) : []);
  const participantStats = $derived(messages && messages.length ? buildParticipantStats(messages) : []);

  function bumpViewport() {
    viewport = typeof window !== 'undefined' ? window.innerWidth + window.innerHeight : 0;
  }

  onMount(() => {
    bumpViewport();
    const onResize = () => bumpViewport();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', () => setTimeout(bumpViewport, 200));

    return () => {
      window.removeEventListener('resize', onResize);
    };
  });

  async function applyParsedText(text: string, okMsg: string) {
    busy = true;
    status = { text: 'Parsing chat…', ok: true };
    try {
      const parsed = parseChatText(text);
      if (!parsed.length) {
        status = { text: 'No valid messages found. Please check your file format.', ok: false };
        messages = null;
        return;
      }
      messages = parsed;
      status = { text: okMsg, ok: true };
      queueMicrotask(() => {
        document.getElementById('file-upload')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } catch (e) {
      status = {
        text: 'Error: ' + (e instanceof Error ? e.message : 'Unknown error.'),
        ok: false,
      };
      messages = null;
    } finally {
      busy = false;
    }
  }

  async function onSample() {
    if (busy) return;
    try {
      busy = true;
      status = { text: 'Loading sample…', ok: true };
      const text = await fetchSampleChat();
      await applyParsedText(text, 'Sample chat loaded.');
    } catch (e) {
      status = {
        text: 'Error loading sample: ' + (e instanceof Error ? e.message : String(e)),
        ok: false,
      };
    } finally {
      busy = false;
    }
  }

  async function onPickFile(file: File) {
    if (busy) return;
    try {
      busy = true;
      status = { text: file.name.toLowerCase().endsWith('.zip') ? 'Reading zip…' : 'Reading file…', ok: true };
      const text = await readChatFromFile(file);
      await applyParsedText(text, 'File parsed successfully.');
    } catch (e) {
      status = { text: e instanceof Error ? e.message : String(e), ok: false };
    } finally {
      busy = false;
    }
  }

</script>

<svelte:head>
  <title>WhatsStats</title>
</svelte:head>

<header class="site-header">
  <img
    class="logo"
    src="{base}assets/WhatsStats_logo.png"
    alt="WhatsStats"
    width="320"
    height="120"
  />
  <div class="tagline-stack">
    <p class="tagline-intro">
      <strong class="tagline-brand">WhatsStats</strong><br />
      <span class="tagline-lead"
        >Upload your exported WhatsApp chat and explore interactive stats.</span
      >
    </p>
    <p class="tagline-privacy">
      Everything runs in your browser.<br />
      Nothing is uploaded to a server.
    </p>
  </div>
</header>

<main class="site-main">
    <section class="card instructions-card" aria-labelledby="how-heading">
      <details class="details">
        <summary class="details-summary" id="how-heading">
          <span>How to export your chat</span>
          <span class="chevron" aria-hidden="true">▼</span>
        </summary>
        <div class="details-body">
          <div class="tabs" role="tablist">
            <button
              type="button"
              role="tab"
              class="tab"
              aria-selected={instructionTab === 'android'}
              class:active={instructionTab === 'android'}
              onclick={() => (instructionTab = 'android')}>Android</button
            >
            <button
              type="button"
              role="tab"
              class="tab"
              aria-selected={instructionTab === 'iphone'}
              class:active={instructionTab === 'iphone'}
              onclick={() => (instructionTab = 'iphone')}>iPhone</button
            >
          </div>
          {#if instructionTab === 'android'}
            <ol class="steps">
              <li>Open the chat → tap ⋮ → More → Export Chat.</li>
              <li>
                Choose <strong>Without Media</strong><br />
                <span class="step-continuation"
                  >WhatsApp saves a <strong>.zip</strong> (or you can share the <strong>.txt</strong>).</span
                >
              </li>
              <li>Upload that <strong>.zip</strong> or <strong>.txt</strong> below.</li>
            </ol>
          {:else}
            <ol class="steps">
              <li>Open the chat → tap the contact or group name at the top.</li>
              <li>
                Tap Export Chat → <strong>Without Media</strong><br />
                <span class="step-continuation"
                  >You get a <strong>.zip</strong> (or the <strong>.txt</strong>).</span
                >
              </li>
              <li>Upload that <strong>.zip</strong> or <strong>.txt</strong> below.</li>
            </ol>
          {/if}
          <p class="note"><strong>Note:</strong> WhatsApp exports are limited to about 40,000 messages per file.</p>
        </div>
      </details>
    </section>

    <section class="upload-section" id="file-upload" aria-label="Upload chat file">
      <div
        class="upload-card"
        class:drag={dragOver}
        role="group"
        ondragover={(e) => {
          e.preventDefault();
          dragOver = true;
        }}
        ondragleave={() => (dragOver = false)}
        ondrop={(e) => {
          e.preventDefault();
          dragOver = false;
          const f = e.dataTransfer?.files?.[0];
          if (f) void onPickFile(f);
        }}
      >
        <input
          bind:this={fileInput}
          type="file"
          accept=".txt,.zip"
          class="sr-only"
          onchange={(e) => {
            const f = e.currentTarget.files?.[0];
            if (f) void onPickFile(f);
            e.currentTarget.value = '';
          }}
        />
        <div class="upload-actions">
          <button type="button" class="btn-secondary" disabled={busy} onclick={onSample}>
            Try sample chat
          </button>
          <span class="or">or</span>
          <button type="button" class="btn-primary" disabled={busy} onclick={() => fileInput?.click()}>
            Upload your chat
          </button>
        </div>
        <p class="upload-hint">
          Tap <strong>Upload your chat</strong> to choose a file, or drag and drop a <strong>.txt</strong> or
          <strong>.zip</strong> export.
        </p>
        {#if status}
          <p class="status" class:status--ok={status.ok} class:status--err={!status.ok}>{status.text}</p>
        {/if}
      </div>
    </section>

  {#if hasData && messages}
    <section class="section-block" aria-labelledby="summary-heading">
      <h2 id="summary-heading" class="section-title">Chat summary</h2>
      <div class="summary-grid">
        {#each summaryCards as c}
          <div class="summary-cell">
            <span class="summary-label">{c.label}</span>
            <span class="summary-value" use:tooltip={c.hint}>{c.value}</span>
          </div>
        {/each}
      </div>
    </section>

    <section class="section-block" aria-labelledby="participants-heading">
      <h2 id="participants-heading" class="section-title">Participant summaries</h2>
      <div class="participant-grid">
        {#each participantStats as stat}
          <article class="participant-card">
            <h3 class="participant-name">{stat.user}</h3>
            <dl class="stat-dl">
              <div><dt>Messages</dt><dd>{stat.numMessages}</dd></div>
              <div>
                <dt>Last message</dt>
                <dd use:tooltip={stat.lastMsgTime?.toLocaleString() ?? undefined}
                  >{stat.lastMsgTime ? stat.lastMsgTime.toLocaleDateString() : '—'}</dd
                >
              </div>
              <div>
                <dt>Longest gap</dt>
                <dd use:tooltip={stat.longestGap ? gapTitle(stat) : undefined}
                  >{stat.longestGap ? formatDuration(stat.longestGap) : '—'}</dd
                >
              </div>
              <div>
                <dt>Night owl</dt>
                <dd use:tooltip={stat.nightOwlDetail || undefined}>{stat.nightOwlScore}</dd>
              </div>
              <div><dt>Avg. length</dt><dd>{stat.avgMsgLen} chars</dd></div>
              <div>
                <dt>Longest message</dt>
                <dd use:tooltip={stat.longestMsgText || undefined}>{stat.longestMsgLen} chars</dd>
              </div>
              <div><dt>Unique words</dt><dd>{stat.nUniqueWords}</dd></div>
              <div>
                <dt>Emoji frequency</dt>
                <dd use:tooltip={stat.emojiFrequencyDetail || undefined}>{stat.emojiFrequency}</dd>
              </div>
              <div>
                <dt>Media · links</dt>
                <dd>{stat.mediaCount} · {stat.linkCount}</dd>
              </div>
            </dl>
            <p class="mini-heading">Top emojis</p>
            <div class="emoji-row">
              {#each stat.topEmojis as e}
                <span class="emoji-chip" use:tooltip={`${stat.emojiCounts[e] ?? 0} uses`}
                  >{withVariationSelector(e)}</span
                >
              {:else}
                <span class="muted">—</span>
              {/each}
            </div>
            <p class="mini-heading">Most used words</p>
            <div class="word-row">
              {#each stat.topWords as w}
                <span class="word-chip" use:tooltip={`${w.word}: ${w.count} uses`}>{w.word}</span>
              {:else}
                <span class="muted">—</span>
              {/each}
            </div>
            <p class="mini-heading">Most used unique words</p>
            <div class="word-row">
              {#each stat.topUniqueWords as w}
                <span
                  class="word-chip"
                  use:tooltip={`${w.word} (${w.count} uses, TF-IDF: ${w.score.toFixed(3)})`}>{w.word}</span
                >
              {:else}
                <span class="muted">—</span>
              {/each}
            </div>
            <p class="mini-heading">Most used unique 2-grams</p>
            <div class="word-row">
              {#each stat.topUniqueBigrams as w}
                <span
                  class="word-chip"
                  use:tooltip={`${w.word} (${w.count} uses, TF-IDF: ${w.score.toFixed(3)})`}>{w.word}</span
                >
              {:else}
                <span class="muted">—</span>
              {/each}
            </div>
          </article>
        {/each}
      </div>
    </section>

    <section class="section-block viz-section" aria-labelledby="viz-heading">
      <h2 id="viz-heading" class="section-title">Visualizations</h2>
      <p class="viz-tip" aria-live="polite">
        <span class="viz-tip-lead">Tip: charts are easier to read in landscape.</span><br />
        <span class="viz-tip-detail">Rotate your device if you like.</span>
      </p>

      <h3 class="subsection-title">Overall chat</h3>
      <div class="viz-card">
        <PlotlyViz messages={messages} render={renderActivityOverTime} viewport={viewport} />
      </div>
      <div class="viz-card">
        <PlotlyViz messages={messages} render={renderWeeklyHeatmap} viewport={viewport} />
      </div>
      <div class="viz-card">
        <PlotlyViz messages={messages} render={renderEmojiChart} viewport={viewport} />
      </div>
      <div class="viz-card">
        <PlotlyViz messages={messages} render={renderEmojiTrends} viewport={viewport} />
      </div>
      <div class="viz-card">
        <PlotlyViz messages={messages} render={renderWordCloud} viewport={viewport} />
      </div>
      <div class="viz-card">
        <PlotlyViz messages={messages} render={renderMostUsedWords} viewport={viewport} />
      </div>
      <div class="viz-card">
        <PlotlyViz messages={messages} render={renderMessageLengthHistogram} viewport={viewport} />
      </div>
      <div class="viz-card silences-card">
        <LongestSilencesTable {messages} />
      </div>

      <h3 class="subsection-title">By participant</h3>
      <div class="viz-card">
        <PlotlyViz messages={messages} render={renderLongestStreaks} viewport={viewport} />
      </div>
      <div class="viz-card">
        <PlotlyViz messages={messages} render={renderActivityOverTimeGrouped} viewport={viewport} />
      </div>
      <div class="viz-card">
        <PlotlyViz messages={messages} render={renderActivityOverTimeStackedPercent} viewport={viewport} />
      </div>
      <div class="viz-card">
        <PlotlyViz messages={messages} render={renderHourlyActivity} viewport={viewport} />
      </div>
      <div class="viz-card">
        <PlotlyViz messages={messages} render={renderWhoFollowsWhomHeatmap} viewport={viewport} />
      </div>
    </section>
  {/if}
</main>
