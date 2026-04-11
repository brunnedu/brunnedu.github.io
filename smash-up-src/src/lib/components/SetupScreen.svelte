<script>
  import PlayerInput from './PlayerInput.svelte';

  let {
    players = $bindable([]),
    bestOf = $bindable(false),
    showColdResume = false,
    onResume = () => {},
    onDiscard = () => {},
    onGenerateSchedule = () => {},
  } = $props();
</script>

<div class="setup-screen">
  <header class="setup-hero">
    <h1 class="landing-title">SmashUp</h1>
    <p class="landing-tagline">Pair up. Smash it. Track it.</p>
  </header>

  {#if showColdResume}
    <div class="cold-resume-banner" role="region" aria-label="Previous session">
      <p class="cold-resume-text">A saved session from last time is on this device.</p>
      <div class="cold-resume-actions">
        <button type="button" class="btn-primary" onclick={onResume}>
          Resume last session
        </button>
        <button type="button" class="btn-text-danger" onclick={onDiscard}>
          Discard saved session
        </button>
      </div>
    </div>
  {/if}

  <PlayerInput
    bind:players
    bind:bestOf
    onGenerateSchedule={onGenerateSchedule}
  />
</div>
