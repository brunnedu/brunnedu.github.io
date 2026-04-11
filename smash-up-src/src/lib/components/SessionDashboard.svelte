<script>
  import {
    sessionStore,
    applyCurrentSlots,
    saveCurrentMatchResult,
    updateCompletedMatchScore,
    getActiveMatchPairing,
    getSuggestedNextThree,
    deriveRoundState,
    matchKey,
  } from '../stores.js';
  import { generateAllMatchups } from '../scheduler.js';
  import MatchCard from './MatchCard.svelte';
  import ScoreEntry from './ScoreEntry.svelte';
  import Standings from './Standings.svelte';
  import ExportButton from './ExportButton.svelte';
  import CurrentMatchPicker from './CurrentMatchPicker.svelte';

  let editingGame = $state(null);
  let editingSets = $state(null);
  let pickerOpen = $state(false);

  const totalCanonical = $derived(
    generateAllMatchups($sessionStore.players).length
  );
  const playedCount = $derived($sessionStore.completed.length);
  const roundMeta = $derived(
    deriveRoundState($sessionStore.players, $sessionStore.completed)
  );
  const activeMatch = $derived(getActiveMatchPairing($sessionStore));
  const suggestedNext = $derived(getSuggestedNextThree($sessionStore));
  const completedMatches = $derived($sessionStore.completed);
  const completedMatchesDisplayed = $derived(
    [...completedMatches].reverse()
  );
  const bestOf = $derived($sessionStore.bestOf);
  const canExport = $derived(playedCount >= 1);

  function closeEdit() {
    editingGame = null;
    editingSets = null;
  }

  function startEdit(match) {
    editingGame = match.game;
    editingSets = match.sets.map((s) => ({ scoreA: s.scoreA, scoreB: s.scoreB }));
  }

  function handleSaveScore(sets, winner) {
    if (!activeMatch) return;
    saveCurrentMatchResult(sets, winner);
    pickerOpen = false;
  }

  function handleEditSave(sets, winner) {
    if (editingGame == null) return;
    updateCompletedMatchScore(editingGame, sets, winner);
    closeEdit();
  }

  function handleSlotsChange(slots) {
    applyCurrentSlots(slots);
  }

  function scoreEntryFormKey() {
    if (!activeMatch) return 'cur';
    return `cur-${playedCount}-${matchKey(activeMatch)}`;
  }
</script>

<section class="session-dashboard">
  <div class="session-header">
    <div class="session-header-brand">
      <div class="session-header-top">
        <div class="session-header-text">
          <h2 class="session-brand-title">SmashUp</h2>
          {#if totalCanonical > 0}
            <p class="session-meta-line">{totalCanonical} match-ups</p>
          {/if}
          {#if roundMeta.suggestionRound > 1}
            <p class="session-round-line">Round {roundMeta.suggestionRound}</p>
          {/if}
        </div>
        <div class="session-header-actions">
          <ExportButton
            session={$sessionStore}
            disabled={!canExport}
          />
        </div>
      </div>
    </div>
  </div>

  {#if activeMatch}
    <div class="current-match card">
      <h3>Now Playing</h3>
      <button
        type="button"
        class="current-match-tap"
        onclick={() => (pickerOpen = !pickerOpen)}
        aria-expanded={pickerOpen}
      >
        <MatchCard match={activeMatch} />
        <span class="current-match-tap-hint">
          {pickerOpen ? 'Hide' : 'Choose players'}
        </span>
      </button>
      {#if pickerOpen}
        <CurrentMatchPicker
          players={$sessionStore.players}
          pairing={activeMatch}
          onSlotsChange={handleSlotsChange}
        />
      {/if}
      <ScoreEntry
        bestOf={bestOf}
        formKey={scoreEntryFormKey()}
        onSave={handleSaveScore}
      />
    </div>
  {/if}

  {#if suggestedNext.length > 0}
    <div class="upcoming">
      <h3>Suggested next</h3>
      {#each suggestedNext as match}
        <MatchCard match={match} compact />
      {/each}
    </div>
  {/if}

  <Standings matches={$sessionStore.completed} players={$sessionStore.players} />

  {#if completedMatches.length > 0}
    <div class="completed">
      <h3>Completed</h3>
      {#each completedMatchesDisplayed as match}
        <div
          class="completed-row"
          class:is-editing={editingGame === match.game}
        >
          {#if editingGame === match.game}
            <MatchCard
              match={match}
              winner={match.winner}
              compact
              showGameIndex
            />
            <ScoreEntry
              bestOf={bestOf}
              formKey={editingGame}
              initialSets={editingSets}
              onSave={handleEditSave}
              onCancel={closeEdit}
            />
          {:else}
            <button
              type="button"
              class="completed-row-trigger"
              aria-label={`Edit score for game ${match.game}: ${match.teamA.join(' & ')} vs ${match.teamB.join(' & ')}`}
              onclick={() => startEdit(match)}
            >
              <div class="completed-row-main">
                <MatchCard
                  match={match}
                  winner={match.winner}
                  compact
                  showGameIndex
                />
              </div>
              <span class="completed-row-icon" aria-hidden="true">
                <svg
                  class="edit-pencil-svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M12 20h9" />
                  <path
                    d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
                  />
                </svg>
              </span>
            </button>
          {/if}
        </div>
      {/each}
    </div>
  {:else}
    <p class="muted">No matches played yet.</p>
  {/if}
</section>
