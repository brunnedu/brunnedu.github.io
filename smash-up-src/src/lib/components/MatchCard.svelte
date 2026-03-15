<script>
  let { match, winner = null, compact = false } = $props();
</script>

<div
  class="match-card"
  class:compact
  class:winner-a={winner === 'A'}
  class:winner-b={winner === 'B'}
>
  <div class="match-teams">
    <span class="team team-a">{match.teamA.join(' & ')}</span>
    <span class="vs">vs</span>
    <span class="team team-b">{match.teamB.join(' & ')}</span>
  </div>
  {#if match.sets && match.sets.length > 0}
    <div class="match-score">
      {#each match.sets as set}
        <span class="set-score">
          {set.scoreA}–{set.scoreB}
        </span>
      {/each}
    </div>
  {/if}
</div>
