<script lang="ts">
  import { onMount } from 'svelte';
  import { Tag, X, Plus } from '@lucide/svelte';
  import { TagsService, type TagItem } from '$lib/services/tagsService';

  let { 
    tags = $bindable([]),
    placeholder = 'Aggiungi tag (es. #urgente)...' 
  }: {
    tags: string[];
    placeholder?: string;
  } = $props();

  let inputVal = $state('');
  let suggestions = $state<TagItem[]>([]);
  let showSuggestions = $state(false);

  onMount(async () => {
    suggestions = await TagsService.getTags();
  });

  let filteredSuggestions = $derived(
    suggestions.filter(s => {
      const norm = TagsService.normalizeTag(inputVal);
      if (!norm) return true;
      return s.normalized.includes(norm) && !tags.some(t => TagsService.normalizeTag(t) === s.normalized);
    })
  );

  function addTag(name: string) {
    const clean = name.replace(/^#/, '').trim();
    if (!clean) return;
    const norm = TagsService.normalizeTag(clean);
    if (tags.some(t => TagsService.normalizeTag(t) === norm)) {
      inputVal = '';
      showSuggestions = false;
      return;
    }

    tags = [...tags, clean];
    inputVal = '';
    showSuggestions = false;
    TagsService.ensureTagsExist([clean]);
  }

  function removeTag(index: number) {
    tags = tags.filter((_, i) => i !== index);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputVal);
    }
  }
</script>

<div class="tag-input-container">
  <div class="tags-wrapper">
    {#each tags as tag, idx}
      <span class="tag-badge">
        <Tag size={12} class="tag-icon" />
        <span class="tag-text">#{tag}</span>
        <button type="button" class="btn-remove-tag" onclick={() => removeTag(idx)} title="Rimuovi tag">
          <X size={12} />
        </button>
      </span>
    {/each}

    <div class="input-relative">
      <input
        type="text"
        bind:value={inputVal}
        {placeholder}
        class="tag-field"
        onfocus={() => (showSuggestions = true)}
        onblur={() => setTimeout(() => (showSuggestions = false), 200)}
        onkeydown={handleKeyDown}
      />

      {#if showSuggestions && filteredSuggestions.length > 0}
        <div class="suggestions-dropdown animate-fade-in">
          {#each filteredSuggestions.slice(0, 6) as sug}
            <button
              type="button"
              class="suggestion-item"
              onmousedown={() => addTag(sug.name)}
            >
              <Tag size={12} /> #{sug.name}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .tag-input-container {
    width: 100%;
  }

  .tags-wrapper {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem;
    background: var(--bg-surface, #ffffff);
    border: 1px solid var(--border-color, #cbd5e1);
    border-radius: 8px;
    min-height: 42px;
  }

  .tag-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    background: var(--bg-subtle, #f1f5f9);
    border: 1px solid var(--border-color, #e2e8f0);
    color: var(--color-primary, #2563eb);
    font-size: 0.8125rem;
    font-weight: 600;
    padding: 0.25rem 0.5rem;
    border-radius: 6px;
  }

  .tag-icon {
    opacity: 0.7;
  }

  .btn-remove-tag {
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--text-muted, #64748b);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1px;
    border-radius: 3px;
  }

  .btn-remove-tag:hover {
    background: rgba(225, 29, 72, 0.1);
    color: #e11d48;
  }

  .input-relative {
    position: relative;
    flex: 1;
    min-width: 160px;
  }

  .tag-field {
    width: 100%;
    border: none;
    outline: none;
    font-size: 0.875rem;
    background: transparent;
    color: var(--text-main, #334155);
  }

  .suggestions-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    width: 100%;
    max-width: 260px;
    background: var(--bg-surface, #ffffff);
    border: 1px solid var(--border-color, #e2e8f0);
    border-radius: 8px;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    z-index: 50;
    overflow: hidden;
  }

  .suggestion-item {
    width: 100%;
    text-align: left;
    padding: 0.5rem 0.75rem;
    border: none;
    background: transparent;
    font-size: 0.8125rem;
    color: var(--text-main, #334155);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .suggestion-item:hover {
    background: var(--bg-subtle, #f8fafc);
    color: var(--color-primary, #2563eb);
  }
</style>
