<script>
  let { onStart = () => {} } = $props();
</script>

<section class="landing">
  <h1 class="landing-title">SmashUp</h1>
  <p class="landing-tagline">Pair up. Smash it. Track it.</p>
  <button type="button" class="btn-primary" onclick={onStart}>
    New Session
  </button>
</section>
