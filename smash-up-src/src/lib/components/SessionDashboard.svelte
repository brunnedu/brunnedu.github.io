<script>
  import { sessionStore } from '../stores.js';
  import { setMatchScore } from '../stores.js';
  import MatchCard from './MatchCard.svelte';
  import ScoreEntry from './ScoreEntry.svelte';
  import Standings from './Standings.svelte';
  import ExportButton from './ExportButton.svelte';

  let editingGame = $state(null);
  let editingSets = $state(null);

  const totalMatches = $derived($sessionStore.matches.length);
  const playedCount = $derived(
    $sessionStore.matches.filter((m) => m.sets && m.winner).length
  );
  const currentMatch = $derived(
    $sessionStore.matches.find((m) => !m.sets || !m.winner)
  );
  const completedMatches = $derived(
    $sessionStore.matches.filter((m) => m.sets && m.winner)
  );
  /** Most recent first; each row still shows schedule game number. */
  const completedMatchesDisplayed = $derived(
    [...completedMatches].reverse()
  );
  const upcomingMatches = $derived(
    $sessionStore.matches.filter((m) => !m.sets || !m.winner).slice(1, 4)
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
    if (!currentMatch) return;
    setMatchScore(currentMatch.game, sets, winner);
  }

  function handleEditSave(sets, winner) {
    if (editingGame == null) return;
    setMatchScore(editingGame, sets, winner);
    closeEdit();
  }
</script>

<section class="session-dashboard">
  <div class="session-header">
    <div class="session-header-top">
      <h2 class="section-title">
        Game {currentMatch ? playedCount + 1 : playedCount} / {totalMatches}
      </h2>
      <ExportButton
        session={$sessionStore}
        disabled={!canExport}
      />
    </div>
    <div class="progress-bar">
      <div
        class="progress-fill"
        style="width: {totalMatches ? (playedCount / totalMatches) * 100 : 0}%"
      ></div>
    </div>
  </div>

  {#if currentMatch}
    <div class="current-match card">
      <h3>Now Playing</h3>
      <MatchCard match={currentMatch} />
      <ScoreEntry
        bestOf={bestOf}
        formKey={`cur-${currentMatch.game}`}
        onSave={handleSaveScore}
      />
    </div>
  {/if}

  {#if upcomingMatches.length > 0}
    <div class="upcoming">
      <h3>Up Next</h3>
      {#each upcomingMatches as match}
        <MatchCard match={match} compact />
      {/each}
    </div>
  {/if}

  <Standings matches={$sessionStore.matches} players={$sessionStore.players} />

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
