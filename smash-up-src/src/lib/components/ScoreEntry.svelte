<script>
  let { bestOf = false, onSave = () => {} } = $props();

  const numSets = $derived(bestOf ? 3 : 1);
  let scores = $state([
    { scoreA: '', scoreB: '' },
    { scoreA: '', scoreB: '' },
    { scoreA: '', scoreB: '' },
  ]);

  function computeWinner() {
    let winsA = 0;
    let winsB = 0;
    const validSets = [];
    for (let i = 0; i < numSets; i++) {
      const a = parseInt(scores[i].scoreA, 10);
      const b = parseInt(scores[i].scoreB, 10);
      if (isNaN(a) || isNaN(b) || a < 0 || b < 0) continue;
      validSets.push({ scoreA: a, scoreB: b });
      if (a > b) winsA++;
      else if (b > a) winsB++;
    }
    if (validSets.length === 0) return null;
    const target = bestOf ? 2 : 1;
    if (winsA >= target) return { sets: validSets, winner: 'A' };
    if (winsB >= target) return { sets: validSets, winner: 'B' };
    return null;
  }

  function handleSave() {
    const result = computeWinner();
    if (result) {
      onSave(result.sets, result.winner);
      scores = [
        { scoreA: '', scoreB: '' },
        { scoreA: '', scoreB: '' },
        { scoreA: '', scoreB: '' },
      ];
    }
  }

  const canSave = $derived(computeWinner() !== null);
</script>

<div class="score-entry">
  {#each scores.slice(0, numSets) as set, i}
    <div class="score-row">
      <input
        type="number"
        min="0"
        placeholder="0"
        bind:value={scores[i].scoreA}
        aria-label="Team A score"
      />
      <span class="score-sep">–</span>
      <input
        type="number"
        min="0"
        placeholder="0"
        bind:value={scores[i].scoreB}
        aria-label="Team B score"
      />
      {#if bestOf}
        <span class="set-label">Set {i + 1}</span>
      {/if}
    </div>
  {/each}
  <button
    type="button"
    class="btn-primary btn-save"
    disabled={!canSave}
    onclick={handleSave}
  >
    Save
  </button>
</div>
