<script>
  import SetupScreen from './lib/components/SetupScreen.svelte';
  import SessionDashboard from './lib/components/SessionDashboard.svelte';
  import { sessionStore, initSession, resetSession, normalizeSessionState } from './lib/stores.js';
  import { generateAllMatchups } from './lib/scheduler.js';
  import {
    getBootstrapHydration,
    hasSavedSession,
    readSavedSession,
    persistUiState,
  } from './lib/sessionPersistence.js';

  const boot = getBootstrapHydration();

  let screen = $state('setup');
  let players = $state([]);
  let bestOf = $state(false);
  let showColdResume = $state(false);

  if (boot.mode === 'same-tab' && boot.session?.players?.length >= 4 && boot.session?.date) {
    sessionStore.set(normalizeSessionState(boot.session));
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
    if (players.length < 4) return;
    initSession(players, bestOf);
    screen = 'session';
    showColdResume = false;
  }

  function resumeLastSession() {
    const s = readSavedSession();
    if (!s) return;
    sessionStore.set(normalizeSessionState(s));
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
