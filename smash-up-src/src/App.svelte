<script>
  import Landing from './lib/components/Landing.svelte';
  import PlayerInput from './lib/components/PlayerInput.svelte';

  let screen = $state('landing');
  let players = $state([]);
  let bestOf = $state(false);

  function handleStart() {
    screen = 'player-input';
    players = [];
    bestOf = false;
  }

  function handleGenerateSchedule() {
    screen = 'session';
  }
</script>

{#if screen === 'landing'}
  <Landing onStart={handleStart} />
{:else if screen === 'player-input'}
  <PlayerInput
    bind:players
    bind:bestOf
    onGenerateSchedule={handleGenerateSchedule}
  />
  <button type="button" class="btn-back" onclick={() => (screen = 'landing')}>
    ← Back
  </button>
{:else if screen === 'session'}
  <p>Session dashboard (Phase 3+)</p>
  <p>Players: {players.join(', ')} | Best of 3: {bestOf}</p>
  <button type="button" class="btn-back" onclick={() => (screen = 'landing')}>
    ← Back
  </button>
{/if}
