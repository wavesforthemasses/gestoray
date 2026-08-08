<script lang="ts">
  import { onMount } from 'svelte';
  import { Card } from '$lib';
  import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Wrench, GripHorizontal } from '@lucide/svelte';
  import type { CompositeCalendarItem } from '../schema';

  export interface YAxisEntity {
    id: string;
    name: string;
    subtitle?: string;
  }

  interface Props {
    items: CompositeCalendarItem[];
    yAxisEntities: YAxisEntity[];
    yAxisType?: 'teams' | 'users' | 'vehicles' | 'places';
    yAxisLabel?: string;
    onReschedule: (item: CompositeCalendarItem, newDate: string, entityId: string) => Promise<void>;
  }

  let { 
    items, 
    yAxisEntities, 
    yAxisType = 'teams', 
    yAxisLabel = 'SQUADRA',
    onReschedule 
  }: Props = $props();

  let currentDate = $state(new Date());

  let currentWeekStart = $derived.by(() => {
    const d = new Date(currentDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    return new Date(d.setDate(diff));
  });

  let days = $derived.by(() => {
    const result = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(currentWeekStart);
      d.setDate(d.getDate() + i);
      result.push(d);
    }
    return result;
  });

  function formatDate(d: Date) {
    return d.toISOString().split('T')[0];
  }

  function getShortDayName(d: Date) {
    return d.toLocaleDateString('it-IT', { weekday: 'short' }).toUpperCase();
  }

  function getDayNumber(d: Date) {
    return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' });
  }

  function nextWeek() {
    currentDate = new Date(currentDate.setDate(currentDate.getDate() + 7));
  }

  function prevWeek() {
    currentDate = new Date(currentDate.setDate(currentDate.getDate() - 7));
  }

  function today() {
    currentDate = new Date();
  }

  // Target entityType mapping
  const targetEntityType = $derived.by(() => {
    switch (yAxisType) {
      case 'users': return 'user';
      case 'vehicles': return 'vehicle';
      case 'places': return 'place';
      case 'teams':
      default: return 'team';
    }
  });

  // Find items for a specific entity and day
  function getItemsForCell(entityId: string, dateStr: string) {
    return items.filter((item: CompositeCalendarItem) => {
      const isDateMatch = item.date === dateStr || (item.date && item.date.startsWith(dateStr));
      if (!isDateMatch) return false;

      if (yAxisType === 'places' && item.placeId === entityId) return true;

      const isEntityMatch = item.assignedEntities?.some((e: any) => 
        e.entityType === targetEntityType && e.entityId === entityId
      );
      return isEntityMatch;
    });
  }

  // Drag and Drop
  function handleDragStart(e: DragEvent, item: CompositeCalendarItem) {
    if (e.dataTransfer) {
      e.dataTransfer.setData('application/json', JSON.stringify(item));
      e.dataTransfer.effectAllowed = 'move';
    }
  }

  async function handleDrop(e: DragEvent, entityId: string, dateStr: string) {
    e.preventDefault();
    const data = e.dataTransfer?.getData('application/json');
    if (!data) return;

    try {
      const item: CompositeCalendarItem = JSON.parse(data);
      
      const alreadyHasEntity = item.assignedEntities?.some((ent: any) => 
        ent.entityType === targetEntityType && ent.entityId === entityId
      );
      if (item.date === dateStr && alreadyHasEntity) return;

      await onReschedule(item, dateStr, entityId);
    } catch (err) {
      console.error('Invalid drop data', err);
    }
  }
</script>

<div class="matrix-container">
  <div class="matrix-toolbar">
    <div class="month-title">
      <CalendarIcon size={20} class="text-primary-600" />
      <h2>{currentWeekStart.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }).toUpperCase()}</h2>
    </div>
    
    <div class="week-nav">
      <button class="nav-btn" onclick={prevWeek}><ChevronLeft size={20} /></button>
      <button class="nav-btn today-btn" onclick={today}>OGGI</button>
      <button class="nav-btn" onclick={nextWeek}><ChevronRight size={20} /></button>
    </div>
  </div>

  <div class="matrix-scroll-wrapper">
    <table class="matrix-table">
      <thead>
        <tr>
          <th class="col-teams">{yAxisLabel}</th>
          {#each days as day}
            <th class="col-day" class:is-today={formatDate(day) === formatDate(new Date())}>
              <div class="day-name">{getShortDayName(day)}</div>
              <div class="day-num">{getDayNumber(day)}</div>
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each yAxisEntities as entity (entity.id)}
          <tr>
            <td class="cell-team">
              <div class="team-name">{entity.name}</div>
              {#if entity.subtitle}
                <div class="team-vehicle">{entity.subtitle}</div>
              {/if}
            </td>
            {#each days as day}
              {@const dateStr = formatDate(day)}
              <td 
                class="cell-day" 
                class:is-today={dateStr === formatDate(new Date())}
                ondragover={(e) => e.preventDefault()}
                ondrop={(e) => handleDrop(e, entity.id, dateStr)}
              >
                <div class="cell-content">
                  {#each getItemsForCell(entity.id, dateStr) as item (item.id)}
                    <div 
                      class="schedule-block {item.source === 'intervention' ? 'block-intervention' : 'block-event'}"
                      draggable="true"
                      ondragstart={(e) => handleDragStart(e, item)}
                    >
                      <div class="block-drag">
                        <GripHorizontal size={12} />
                      </div>
                      <div class="block-info">
                        {#if item.interventionNumber}
                          <span class="block-id">{item.interventionNumber}</span>
                        {/if}
                        <span class="block-title">{item.title}</span>
                        {#if item.placeName}
                          <span class="block-place">{item.placeName}</span>
                        {/if}
                      </div>
                    </div>
                  {/each}
                </div>
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>

<style>
  .matrix-container {
    background: white;
    border-radius: var(--radius-lg);
    border: 1px solid var(--color-neutral-200);
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .matrix-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    border-bottom: 1px solid var(--color-neutral-200);
    background: #f8fafc;
  }
  .month-title {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .month-title h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    color: var(--color-neutral-800);
  }
  .week-nav {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .nav-btn {
    background: white;
    border: 1px solid var(--color-neutral-300);
    border-radius: var(--radius-md);
    padding: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--color-neutral-700);
    transition: all 0.2s;
  }
  .nav-btn:hover {
    background: var(--color-neutral-100);
  }
  .today-btn {
    padding: 6px 16px;
    font-size: 13px;
    font-weight: 600;
  }

  .matrix-scroll-wrapper {
    overflow-x: auto;
    width: 100%;
  }
  .matrix-table {
    width: 100%;
    border-collapse: collapse;
    min-width: 900px;
  }
  .matrix-table th, .matrix-table td {
    border: 1px solid var(--color-neutral-200);
    padding: 12px;
  }
  
  .col-teams {
    width: 200px;
    min-width: 200px;
    background: #f8fafc;
    text-align: left;
    font-size: 12px;
    color: var(--color-neutral-500);
    font-weight: 700;
    text-transform: uppercase;
  }
  .col-day {
    min-width: 140px;
    text-align: center;
    background: #f8fafc;
  }
  .col-day.is-today {
    background: #eff6ff;
    color: var(--color-primary-700);
    border-bottom: 2px solid var(--color-primary-500);
  }
  .day-name {
    font-size: 11px;
    font-weight: 700;
    margin-bottom: 2px;
  }
  .day-num {
    font-size: 16px;
    font-weight: 800;
  }

  .cell-team {
    background: #fcfcfc;
    vertical-align: top;
  }
  .team-name {
    font-size: 14px;
    font-weight: 700;
    color: var(--color-neutral-800);
    margin-bottom: 4px;
  }
  .team-vehicle {
    font-size: 11px;
    color: var(--color-neutral-500);
  }

  .cell-day {
    vertical-align: top;
    min-height: 100px;
    height: 100px;
  }
  .cell-day.is-today {
    background: #fafaf9;
  }
  .cell-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-height: 100%;
  }
  
  .schedule-block {
    padding: 8px;
    border-radius: 6px;
    font-size: 11px;
    cursor: grab;
    display: flex;
    flex-direction: column;
    gap: 4px;
    border: 1px solid transparent;
    transition: transform 0.1s, box-shadow 0.1s;
  }
  .schedule-block:active {
    cursor: grabbing;
    transform: scale(0.98);
  }
  .block-drag {
    display: flex;
    justify-content: center;
    color: rgba(0,0,0,0.3);
    margin-bottom: -4px;
  }
  .block-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .block-intervention {
    background: #fff7ed;
    border-color: #fdba74;
    color: #9a3412;
  }
  .block-event {
    background: #eff6ff;
    border-color: #93c5fd;
    color: #1e40af;
  }
  
  .block-id {
    font-family: monospace;
    font-weight: 800;
  }
  .block-title {
    font-weight: 600;
    line-height: 1.2;
  }
  .block-place {
    font-size: 10px;
    opacity: 0.8;
  }
</style>
