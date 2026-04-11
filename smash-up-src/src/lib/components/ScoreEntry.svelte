<script>
  function blankScores() {
    return [
      { scoreA: '', scoreB: '' },
      { scoreA: '', scoreB: '' },
      { scoreA: '', scoreB: '' },
    ];
  }

  let {
    bestOf = false,
    /** When set, form is seeded (e.g. editing). Omit for a blank “current match” form. */
    initialSets = null,
    /** Change when the logical form should reset (e.g. current game number or edit target). */
    formKey = 'default',
    onSave = () => {},
    onCancel = undefined,
  } = $props();

  const numSets = $derived(bestOf ? 3 : 1);
  let scores = $state(blankScores());

  $effect(() => {
    void formKey;
    void bestOf;
    const raw = initialSets;
    const n = numSets;
    const next = blankScores();
    if (raw && raw.length > 0) {
      for (let i = 0; i < n && i < raw.length; i++) {
        if (raw[i]) {
          next[i] = {
            scoreA: String(raw[i].scoreA ?? ''),
            scoreB: String(raw[i].scoreB ?? ''),
          };
        }
      }
    }
    scores = next;
  });

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
      scores = blankScores();
    }
  }

  function handleCancel() {
    onCancel?.();
  }

  function handleInputKeydown(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    handleSave();
  }

  const canSave = $derived(computeWinner() !== null);
  const showCancel = $derived(typeof onCancel === 'function');
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
        onkeydown={handleInputKeydown}
      />
      <span class="score-sep">–</span>
      <input
        type="number"
        min="0"
        placeholder="0"
        bind:value={scores[i].scoreB}
        aria-label="Team B score"
        onkeydown={handleInputKeydown}
      />
      {#if bestOf}
        <span class="set-label">Set {i + 1}</span>
      {/if}
    </div>
  {/each}
  <div class="score-entry-actions">
    {#if showCancel}
      <button type="button" class="btn-secondary" onclick={handleCancel}>
        Cancel
      </button>
    {/if}
    <button
      type="button"
      class="btn-primary btn-save"
      class:btn-save-wide={!showCancel}
      disabled={!canSave}
      onclick={handleSave}
    >
      Save
    </button>
  </div>
</div>
