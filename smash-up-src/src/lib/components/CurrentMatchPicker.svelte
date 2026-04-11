<script>
  import { onMount } from 'svelte';

  let {
    players = [],
    pairing = null,
    onSlotsChange = () => {},
  } = $props();

  let slots = $state(['', '', '', '']);

  onMount(() => {
    if (pairing?.teamA?.length === 2 && pairing?.teamB?.length === 2) {
      slots = [...pairing.teamA, ...pairing.teamB];
    } else {
      slots = ['', '', '', ''];
    }
    onSlotsChange([...slots]);
  });

  function optionsForSlot(index) {
    const cur = slots[index];
    const taken = new Set(
      slots.map((s, i) => (i !== index && s ? s : null)).filter(Boolean)
    );
    const base = players.filter((p) => !taken.has(p));
    if (cur && !base.includes(cur)) return [cur, ...base];
    return base;
  }

  function handleSelect(index, value) {
    const next = [...slots];
    next[index] = value;
    slots = next;
    onSlotsChange([...next]);
  }
</script>

<div class="current-match-picker" role="group" aria-label="Choose players for this game">
  <div class="picker-row">
    <label class="picker-label" for="slot-0">Team 1 — player 1</label>
    <select
      id="slot-0"
      class="picker-select"
      value={slots[0]}
      onchange={(e) => handleSelect(0, e.currentTarget.value)}
    >
      <option value="">Select…</option>
      {#each optionsForSlot(0) as p}
        <option value={p}>{p}</option>
      {/each}
    </select>
  </div>
  <div class="picker-row">
    <label class="picker-label" for="slot-1">Team 1 — player 2</label>
    <select
      id="slot-1"
      class="picker-select"
      value={slots[1]}
      onchange={(e) => handleSelect(1, e.currentTarget.value)}
    >
      <option value="">Select…</option>
      {#each optionsForSlot(1) as p}
        <option value={p}>{p}</option>
      {/each}
    </select>
  </div>
  <div class="picker-row">
    <label class="picker-label" for="slot-2">Team 2 — player 1</label>
    <select
      id="slot-2"
      class="picker-select"
      value={slots[2]}
      onchange={(e) => handleSelect(2, e.currentTarget.value)}
    >
      <option value="">Select…</option>
      {#each optionsForSlot(2) as p}
        <option value={p}>{p}</option>
      {/each}
    </select>
  </div>
  <div class="picker-row">
    <label class="picker-label" for="slot-3">Team 2 — player 2</label>
    <select
      id="slot-3"
      class="picker-select"
      value={slots[3]}
      onchange={(e) => handleSelect(3, e.currentTarget.value)}
    >
      <option value="">Select…</option>
      {#each optionsForSlot(3) as p}
        <option value={p}>{p}</option>
      {/each}
    </select>
  </div>
</div>
