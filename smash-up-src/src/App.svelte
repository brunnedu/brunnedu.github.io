<script>
  import SetupScreen from './lib/components/SetupScreen.svelte';
  import SessionDashboard from './lib/components/SessionDashboard.svelte';
  import { initSession } from './lib/stores.js';
  import { generateAllMatchups, scheduleFairRotation } from './lib/scheduler.js';

  let screen = $state('setup');
  let players = $state([]);
  let bestOf = $state(false);

  function handleGenerateSchedule() {
    const matchups = generateAllMatchups(players);
    const scheduled = scheduleFairRotation(matchups, players);
    initSession(players, bestOf, scheduled);
    screen = 'session';
  }
</script>

{#if screen === 'setup'}
  <SetupScreen
    bind:players
    bind:bestOf
    onGenerateSchedule={handleGenerateSchedule}
  />
{:else}
  <SessionDashboard />
  <button type="button" class="btn-back" onclick={() => (screen = 'setup')}>
    ← Back
  </button>
{/if}
