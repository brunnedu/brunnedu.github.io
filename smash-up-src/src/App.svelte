<script>
  import Landing from './lib/components/Landing.svelte';
  import PlayerInput from './lib/components/PlayerInput.svelte';
  import SessionDashboard from './lib/components/SessionDashboard.svelte';
  import { initSession } from './lib/stores.js';
  import { generateAllMatchups, scheduleFairRotation } from './lib/scheduler.js';

  let screen = $state('landing');
  let players = $state([]);
  let bestOf = $state(false);

  function handleStart() {
    screen = 'player-input';
    players = [];
    bestOf = false;
  }

  function handleGenerateSchedule() {
    const matchups = generateAllMatchups(players);
    const scheduled = scheduleFairRotation(matchups, players);
    initSession(players, bestOf, scheduled);
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
  <SessionDashboard />
  <button type="button" class="btn-back" onclick={() => (screen = 'landing')}>
    ← Back
  </button>
{/if}
