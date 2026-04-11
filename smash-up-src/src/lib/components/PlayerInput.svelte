<script>
  import { getRecentPlayers, addRecentPlayer } from '../playerStorage.js';

  let {
    players = $bindable([]),
    bestOf = $bindable(false),
    onGenerateSchedule = () => {},
  } = $props();

  let inputValue = $state('');
  let showSuggestions = $state(false);
  let suggestions = $state([]);
  /** @type {HTMLDivElement | null} */
  let wrapperEl = $state(null);
  /** @type {HTMLInputElement | null} */
  let inputEl = $state(null);

  const MIN_PLAYERS = 4;
  const MAX_PLAYERS = 12;
  const WARN_AT = 8;

  const playerCount = $derived(players.length);
  const canGenerate = $derived(playerCount >= MIN_PLAYERS && playerCount <= MAX_PLAYERS);
  const showWarning = $derived(playerCount > WARN_AT && playerCount <= MAX_PLAYERS);
  const showError = $derived(playerCount > MAX_PLAYERS);

  function notInPlayers(name) {
    return !players.some((p) => p.toLowerCase() === name.toLowerCase());
  }

  function updateSuggestions() {
    const query = inputValue.trim().toLowerCase();
    const recent = getRecentPlayers().filter(notInPlayers);
    if (!query) {
      suggestions = recent;
    } else {
      suggestions = recent.filter((n) => n.toLowerCase().includes(query));
    }
    showSuggestions = suggestions.length > 0;
  }

  function addPlayer(name) {
    const trimmed = (name || inputValue).trim();
    if (!trimmed || !notInPlayers(trimmed)) return;
    players = [...players, trimmed];
    addRecentPlayer(trimmed);
    inputValue = '';
    updateSuggestions();
  }

  function removePlayer(name) {
    players = players.filter((p) => p !== name);
  }

  function handleKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addPlayer();
    }
  }

  function handleInput() {
    updateSuggestions();
  }

  /** Close list only when focus leaves the input + suggestions area. */
  function handleWrapperFocusOut(e) {
    const next = /** @type {Node | null} */ (e.relatedTarget);
    if (next && wrapperEl?.contains(next)) return;
    showSuggestions = false;
  }

  function selectSuggestion(name, e) {
    if (e) e.preventDefault();
    addPlayer(name);
    queueMicrotask(() => inputEl?.focus());
  }

  function handleGenerate() {
    if (!canGenerate) return;
    onGenerateSchedule();
  }
</script>

<section class="player-input">
  <h2 class="section-title">Who's Playing?</h2>

  <div class="input-row">
    <div
      class="input-wrapper"
      bind:this={wrapperEl}
      onfocusout={handleWrapperFocusOut}
    >
      <input
        type="text"
        placeholder="Add player name..."
        bind:this={inputEl}
        bind:value={inputValue}
        oninput={handleInput}
        onkeydown={handleKeydown}
        onfocus={updateSuggestions}
        aria-label="Player name"
      />
      {#if showSuggestions}
        <ul class="suggestions" role="listbox">
          {#each suggestions as name}
            <li role="option" tabindex="-1" aria-selected="false">
              <button
                type="button"
                class="suggestion-btn"
                onmousedown={(e) => selectSuggestion(name, e)}
              >
                {name}
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
    <button
      type="button"
      class="btn-add"
      onclick={() => addPlayer()}
      aria-label="Add player"
    >
      +
    </button>
  </div>

  <div class="chips">
    {#each players as player}
      <span class="chip">
        {player}
        <button
          type="button"
          class="chip-remove"
          onclick={() => removePlayer(player)}
          aria-label="Remove {player}"
        >
          ×
        </button>
      </span>
    {/each}
  </div>

  <label class="checkbox-row">
    <input type="checkbox" bind:checked={bestOf} />
    <span>Best of 3</span>
  </label>

  {#if showWarning}
    <p class="warning">Large group — scheduling may take longer.</p>
  {/if}
  {#if showError}
    <p class="error">Maximum {MAX_PLAYERS} players. Remove someone to continue.</p>
  {/if}

  <button
    type="button"
    class="btn-primary btn-generate"
    disabled={!canGenerate}
    onclick={handleGenerate}
  >
    Generate Schedule
  </button>
</section>
