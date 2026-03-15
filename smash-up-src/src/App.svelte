<script>
  import Landing from './lib/components/Landing.svelte';

  let screen = $state('landing');

  function handleStart() {
    screen = 'player-input';
  }
</script>

{#if screen === 'landing'}
  <Landing onStart={handleStart} />
{:else if screen === 'player-input'}
  <p>Player input (Phase 2)</p>
  <button type="button" onclick={() => (screen = 'landing')}>Back</button>
{:else if screen === 'session'}
  <p>Session dashboard (Phase 3+)</p>
  <button type="button" onclick={() => (screen = 'landing')}>Back</button>
{/if}
