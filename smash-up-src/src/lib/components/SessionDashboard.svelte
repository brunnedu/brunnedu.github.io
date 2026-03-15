<script>
  import { sessionStore } from '../stores.js';
  import { setMatchScore } from '../stores.js';
  import MatchCard from './MatchCard.svelte';
  import ScoreEntry from './ScoreEntry.svelte';

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
  const upcomingMatches = $derived(
    $sessionStore.matches.filter((m) => !m.sets || !m.winner).slice(1, 4)
  );
  const bestOf = $derived($sessionStore.bestOf);

  function handleSaveScore(sets, winner) {
    if (!currentMatch) return;
    setMatchScore(currentMatch.game, sets, winner);
  }
</script>

<section class="session-dashboard">
  <div class="session-header">
    <h2 class="section-title">
      Game {currentMatch ? playedCount + 1 : playedCount} / {totalMatches}
    </h2>
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
      <ScoreEntry bestOf={bestOf} onSave={handleSaveScore} />
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

  {#if completedMatches.length > 0}
    <div class="completed">
      <h3>Completed</h3>
      {#each completedMatches as match}
        <MatchCard match={match} winner={match.winner} compact />
      {/each}
    </div>
  {:else}
    <p class="muted">No matches played yet.</p>
  {/if}
</section>
