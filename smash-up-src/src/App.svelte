<script>
  import SetupScreen from './lib/components/SetupScreen.svelte';
  import SessionDashboard from './lib/components/SessionDashboard.svelte';
  import { sessionStore, initSession, resetSession } from './lib/stores.js';
  import { generateAllMatchups, scheduleFairRotation } from './lib/scheduler.js';
  import {
    getBootstrapHydration,
    hasSavedSession,
    readSavedSession,
    persistUiState,
    cloneSessionForStore,
  } from './lib/sessionPersistence.js';

  const boot = getBootstrapHydration();

  let screen = $state('setup');
  let players = $state([]);
  let bestOf = $state(false);
  let showColdResume = $state(false);

  if (boot.mode === 'same-tab' && boot.session?.matches?.length) {
    const cloned = cloneSessionForStore(boot.session);
    if (cloned) sessionStore.set(cloned);
    const ui = boot.ui;
    if (ui?.screen === 'session') {
      screen = 'session';
    } else {
      screen = 'setup';
      players = [...(ui?.players ?? [])];
      bestOf = !!ui?.bestOf;
    }
  } else if (boot.mode === 'same-tab') {
    const ui = boot.ui;
    screen = 'setup';
    players = [...(ui?.players ?? [])];
    bestOf = !!ui?.bestOf;
  } else {
    showColdResume = hasSavedSession();
  }

  $effect(() => {
    persistUiState({ screen, players, bestOf });
  });

  function handleGenerateSchedule() {
    const matchups = generateAllMatchups(players);
    const scheduled = scheduleFairRotation(matchups, players);
    initSession(players, bestOf, scheduled);
    screen = 'session';
    showColdResume = false;
  }

  function resumeLastSession() {
    const s = readSavedSession();
    const cloned = cloneSessionForStore(s);
    if (!cloned) return;
    sessionStore.set(cloned);
    screen = 'session';
    showColdResume = false;
  }

  function discardSavedSession() {
    resetSession();
    screen = 'setup';
    players = [];
    bestOf = false;
    showColdResume = false;
  }
</script>

{#if screen === 'setup'}
  <SetupScreen
    bind:players
    bind:bestOf
    {showColdResume}
    onResume={resumeLastSession}
    onDiscard={discardSavedSession}
    onGenerateSchedule={handleGenerateSchedule}
  />
{:else}
  <SessionDashboard />
  <button type="button" class="btn-back" onclick={() => (screen = 'setup')}>
    ← Back
  </button>
{/if}
