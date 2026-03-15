<script>
  import { sessionStore } from '../stores.js';

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
</script>

<section class="session-dashboard">
  <div class="session-header">
    <h2 class="section-title">
      Game {playedCount + 1} / {totalMatches}
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
      <p class="matchup">
        {currentMatch.teamA.join(' & ')} vs {currentMatch.teamB.join(' & ')}
      </p>
      <p class="score-placeholder">[Score entry — Phase 4]</p>
    </div>
  {/if}

  {#if upcomingMatches.length > 0}
    <div class="upcoming">
      <h3>Up Next</h3>
      {#each upcomingMatches as match}
        <p class="matchup muted">
          {match.game}. {match.teamA.join(' & ')} vs {match.teamB.join(' & ')}
        </p>
      {/each}
    </div>
  {/if}

  {#if completedMatches.length > 0}
    <div class="completed">
      <h3>Completed</h3>
      {#each completedMatches as match}
        <p class="matchup">
          ✓ {match.teamA.join(' & ')} {match.sets?.[0]?.scoreA ?? '?'}–
          {match.sets?.[0]?.scoreB ?? '?'} {match.teamB.join(' & ')}
        </p>
      {/each}
    </div>
  {:else}
    <p class="muted">No matches played yet.</p>
  {/if}
</section>
