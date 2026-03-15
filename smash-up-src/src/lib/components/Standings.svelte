<script>
  let { matches = [], players = [] } = $props();

  const standings = $derived.by(() => {
    const stats = new Map();
    for (const p of players) {
      stats.set(p, { wins: 0, losses: 0, games: 0 });
    }
    for (const m of matches) {
      if (!m.sets || !m.winner) continue;
      const teamA = new Set(m.teamA);
      const teamB = new Set(m.teamB);
      const winnerTeam = m.winner === 'A' ? teamA : teamB;
      const loserTeam = m.winner === 'A' ? teamB : teamA;
      for (const p of [...teamA, ...teamB]) {
        stats.get(p).games++;
      }
      for (const p of winnerTeam) {
        stats.get(p).wins++;
      }
      for (const p of loserTeam) {
        stats.get(p).losses++;
      }
    }
    return players
      .map((p) => {
        const s = stats.get(p);
        const winPct = s.games > 0 ? Math.round((s.wins / s.games) * 100) : 0;
        return { player: p, ...s, winPct };
      })
      .filter((s) => s.games > 0)
      .sort((a, b) => b.wins - a.wins || b.winPct - a.winPct);
  });
</script>

<div class="standings">
  <h3>Standings</h3>
  {#if standings.length > 0}
    <table class="standings-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Player</th>
          <th>W</th>
          <th>L</th>
          <th>GP</th>
          <th>Win%</th>
        </tr>
      </thead>
      <tbody>
        {#each standings as row, i}
          <tr>
            <td>{i + 1}</td>
            <td>{row.player}</td>
            <td>{row.wins}</td>
            <td>{row.losses}</td>
            <td>{row.games}</td>
            <td>{row.winPct}%</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {:else}
    <p class="muted">No matches played yet.</p>
  {/if}
</div>
