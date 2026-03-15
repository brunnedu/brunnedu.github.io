<script>
  import PlayerInput from './PlayerInput.svelte';

  let {
    players = $bindable([]),
    bestOf = $bindable(false),
    onGenerateSchedule = () => {},
  } = $props();
</script>

<div class="setup-screen">
  <header class="setup-hero">
    <h1 class="landing-title">SmashUp</h1>
    <p class="landing-tagline">Pair up. Smash it. Track it.</p>
  </header>

  <PlayerInput
    bind:players
    bind:bestOf
    onGenerateSchedule={onGenerateSchedule}
  />
</div>
