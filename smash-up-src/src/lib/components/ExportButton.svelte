<script>
  let { session = null, disabled = false } = $props();

  function exportSession() {
    if (!session || disabled) return;
    const payload = {
      app: 'SmashUp',
      version: '1.0',
      session: {
        date: session.date,
        players: session.players,
        bestOf: session.bestOf ? 3 : 1,
        matches: session.matches
          .filter((m) => m.sets && m.winner)
          .map((m) => ({
            game: m.game,
            teamA: m.teamA,
            teamB: m.teamB,
            sets: m.sets,
            winner: m.winner,
          })),
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smashup-${session.date}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
</script>

<button
  type="button"
  class="btn-export"
  disabled={disabled}
  onclick={exportSession}
  title="Download session as JSON"
>
  Export Session JSON
</button>
