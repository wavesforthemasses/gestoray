<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    text?: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
    delay?: number;
    maxWidth?: string;
    theme?: 'dark' | 'light';
    disabled?: boolean;
    children?: Snippet;
    content?: Snippet;
    class?: string;
  }

  let {
    text = '',
    position = 'top',
    delay = 150,
    maxWidth = '260px',
    theme = 'dark',
    disabled = false,
    children,
    content,
    class: className = ''
  }: Props = $props();

  let isVisible = $state(false);
  let timeoutId: any = null;

  function showTooltip() {
    if (disabled || (!text && !content)) return;
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      isVisible = true;
    }, delay);
  }

  function hideTooltip() {
    clearTimeout(timeoutId);
    isVisible = false;
  }
</script>

<div 
  class="tooltip-wrapper {className}" 
  onmouseenter={showTooltip} 
  onmouseleave={hideTooltip}
  onfocusin={showTooltip}
  onfocusout={hideTooltip}
  role="presentation"
>
  {#if children}
    {@render children()}
  {/if}

  {#if isVisible && !disabled && (text || content)}
    <div 
      class="tooltip-bubble position-{position} theme-{theme} animate-tooltip"
      style:max-width={maxWidth}
      role="tooltip"
    >
      {#if content}
        {@render content()}
      {:else}
        <span class="tooltip-text">{text}</span>
      {/if}
      <div class="tooltip-arrow"></div>
    </div>
  {/if}
</div>

<style>
  .tooltip-wrapper {
    position: relative;
    display: inline-flex;
    align-items: center;
    max-width: 100%;
  }

  .tooltip-bubble {
    position: absolute;
    z-index: 99999;
    width: max-content;
    min-width: 140px;
    max-width: 280px;
    padding: 8px 12px;
    font-size: 12px;
    line-height: 1.45;
    font-weight: 500;
    letter-spacing: 0.01em;
    border-radius: 8px;
    pointer-events: none;
    white-space: normal;
    text-align: center;
    word-break: normal;
    box-shadow: 0 10px 25px -4px rgba(0, 0, 0, 0.35), 0 4px 8px -2px rgba(0, 0, 0, 0.2);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  /* Themes */
  .tooltip-bubble.theme-dark {
    background: rgba(15, 23, 42, 0.96);
    color: #f8fafc;
    border: 1px solid rgba(255, 255, 255, 0.15);
  }

  .tooltip-bubble.theme-light {
    background: rgba(255, 255, 255, 0.98);
    color: #0f172a;
    border: 1px solid rgba(0, 0, 0, 0.1);
    box-shadow: 0 10px 25px -4px rgba(0, 0, 0, 0.12), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  }

  /* Positioning */
  .tooltip-bubble.position-top {
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
  }

  .tooltip-bubble.position-bottom {
    top: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
  }

  .tooltip-bubble.position-left {
    right: calc(100% + 8px);
    top: 50%;
    transform: translateY(-50%);
  }

  .tooltip-bubble.position-right {
    left: calc(100% + 8px);
    top: 50%;
    transform: translateY(-50%);
  }

  /* Arrows */
  .tooltip-arrow {
    position: absolute;
    width: 6px;
    height: 6px;
    background: inherit;
    border: inherit;
    transform: rotate(45deg);
  }

  .position-top .tooltip-arrow {
    bottom: -4px;
    left: 50%;
    margin-left: -3px;
    border-top: none;
    border-left: none;
  }

  .position-bottom .tooltip-arrow {
    top: -4px;
    left: 50%;
    margin-left: -3px;
    border-bottom: none;
    border-right: none;
  }

  .position-left .tooltip-arrow {
    right: -4px;
    top: 50%;
    margin-top: -3px;
    border-left: none;
    border-bottom: none;
  }

  .position-right .tooltip-arrow {
    left: -4px;
    top: 50%;
    margin-top: -3px;
    border-right: none;
    border-top: none;
  }

  /* Animation */
  .animate-tooltip {
    animation: tooltipFadeIn 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }

  @keyframes tooltipFadeIn {
    from {
      opacity: 0;
      transform: scale(0.95) translate(
        var(--tw-translate-x, 0),
        var(--tw-translate-y, 0)
      );
    }
    to {
      opacity: 1;
      transform: scale(1) translate(
        var(--tw-translate-x, 0),
        var(--tw-translate-y, 0)
      );
    }
  }

  .position-top.animate-tooltip {
    --tw-translate-x: -50%;
    --tw-translate-y: 0;
  }
  .position-bottom.animate-tooltip {
    --tw-translate-x: -50%;
    --tw-translate-y: 0;
  }
  .position-left.animate-tooltip {
    --tw-translate-x: 0;
    --tw-translate-y: -50%;
  }
  .position-right.animate-tooltip {
    --tw-translate-x: 0;
    --tw-translate-y: -50%;
  }
</style>
