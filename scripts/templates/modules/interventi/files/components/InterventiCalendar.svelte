<script lang="ts">
  import type { InterventionItem } from '../schema';
  import { goto } from '$app/navigation';
  import { ChevronLeft, ChevronRight } from '@lucide/svelte';

  interface Props {
    interventions: InterventionItem[];
    locationLabel?: string;
  }

  let { interventions = [], locationLabel = 'Destinazione' }: Props = $props();

  let currentDate = $state(new Date());

  const monthNames = [
    'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
    'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
  ];

  const daysOfWeek = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

  function prevMonth() {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
  }

  function nextMonth() {
    currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
  }

  function goToToday() {
    currentDate = new Date();
  }

  let currentYear = $derived(currentDate.getFullYear());
  let currentMonthIndex = $derived(currentDate.getMonth());
  let currentMonthName = $derived(monthNames[currentMonthIndex]);

  // Generate matrix of days for the grid
  let calendarDays = $derived.by(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Adjust for Monday start (0 = Sun, 1 = Mon ... 6 = Sat)
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const daysInMonth = lastDayOfMonth.getDate();

    const prevMonthLastDay = new Date(year, month, 0).getDate();

    const days: Array<{
      date: Date;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      dateString: string; // YYYY-MM-DD
    }> = [];

    // Previous month padding days
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const dayNumber = prevMonthLastDay - i;
      const d = new Date(year, month - 1, dayNumber);
      days.push({
        date: d,
        dayNumber,
        isCurrentMonth: false,
        isToday: false,
        dateString: d.toISOString().split('T')[0]
      });
    }

    const todayStr = new Date().toISOString().split('T')[0];

    // Current month days
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(year, month, day);
      const dateStr = d.toISOString().split('T')[0];
      days.push({
        date: d,
        dayNumber: day,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        dateString: dateStr
      });
    }

    // Next month padding days to fill 5-6 rows (35 or 42 cells)
    const totalCellsNeeded = days.length <= 35 ? 35 : 42;
    const remaining = totalCellsNeeded - days.length;
    for (let day = 1; day <= remaining; day++) {
      const d = new Date(year, month + 1, day);
      days.push({
        date: d,
        dayNumber: day,
        isCurrentMonth: false,
        isToday: false,
        dateString: d.toISOString().split('T')[0]
      });
    }

    return days;
  });

  // Map interventions by date string (YYYY-MM-DD)
  let interventionsByDate = $derived.by(() => {
    const map: Record<string, InterventionItem[]> = {};

    interventions.forEach(item => {
      const dateVal = item.scheduledStartAt || item.executedStartAt || item.createdAt;
      if (!dateVal) return;
      
      let dStr = '';
      const dateStrVal = String(dateVal);
      if (dateStrVal.includes('T')) {
        dStr = dateStrVal.split('T')[0];
      } else if (dateStrVal.includes('/')) {
        // e.g. "25/07/2026, 09:00" or "25/07/2026"
        const parts = dateStrVal.split(',')[0].trim().split('/');
        if (parts.length === 3) {
          dStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      } else {
        dStr = dateStrVal.substring(0, 10);
      }

      if (dStr) {
        if (!map[dStr]) map[dStr] = [];
        map[dStr].push(item);
      }
    });

    return map;
  });

  function getStatusBadgeClass(status?: string): string {
    switch (status) {
      case 'pianificato': return 'status-planned';
      case 'in_lavorazione': return 'status-progress';
      case 'completato': return 'status-completed';
      case 'annullato': return 'status-canceled';
      default: return 'status-planned';
    }
  }

  function getStatusLabel(status?: string): string {
    switch (status) {
      case 'pianificato': return 'Pianificato';
      case 'in_lavorazione': return 'In Lavorazione';
      case 'completato': return 'Completato';
      case 'annullato': return 'Annullato';
      default: return status || 'Pianificato';
    }
  }
</script>

<div class="calendar-container card">
  <!-- Calendar Header Controls -->
  <div class="calendar-header">
    <div class="month-title">
      <h2>{currentMonthName} {currentYear}</h2>
    </div>

    <div class="nav-controls">
      <button type="button" onclick={goToToday} class="btn-today">Oggi</button>
      <div class="btn-group">
        <button type="button" onclick={prevMonth} class="btn-nav" title="Mese precedente"><ChevronLeft size={16} /></button>
        <button type="button" onclick={nextMonth} class="btn-nav" title="Mese successivo"><ChevronRight size={16} /></button>
      </div>
    </div>
  </div>

  <!-- Days Header Row -->
  <div class="weekdays-grid">
    {#each daysOfWeek as day}
      <div class="weekday-cell">{day}</div>
    {/each}
  </div>

  <!-- Month Grid -->
  <div class="days-grid">
    {#each calendarDays as dayCell}
      <div class="day-cell" class:other-month={!dayCell.isCurrentMonth} class:today={dayCell.isToday}>
        <div class="day-number-bar">
          <span class="day-number">{dayCell.dayNumber}</span>
          {#if dayCell.isToday}
            <span class="today-badge">Oggi</span>
          {/if}
        </div>

        <div class="events-list">
          {#if interventionsByDate[dayCell.dateString]}
            {#each interventionsByDate[dayCell.dateString] as item}
              <button 
                type="button" 
                class="event-pill {getStatusBadgeClass(item.status)}"
                onclick={() => goto(`/dashboard/interventi/${item.id}`)}
                title="{item.title} - {item.clientName || 'Cliente'}"
              >
                <span class="event-time">
                  {String(item.scheduledStartAt || item.executedStartAt || '').includes('T') 
                    ? String(item.scheduledStartAt || item.executedStartAt).split('T')[1]?.substring(0, 5) 
                    : String(item.scheduledStartAt || item.executedStartAt || '').includes(',')
                      ? String(item.scheduledStartAt || item.executedStartAt).split(',')[1]?.trim()
                      : ''}
                </span>
                <span class="event-title">{item.title}</span>
              </button>
            {/each}
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>

<style>
  .calendar-container {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-lg);
    padding: 20px;
    box-shadow: var(--shadow-sm);
    margin-top: 16px;
  }

  .calendar-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  }

  .month-title h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    color: var(--color-neutral-900);
  }

  .nav-controls {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .btn-today {
    padding: 6px 14px;
    font-size: 13px;
    font-weight: 600;
    background: var(--color-neutral-100);
    border: 1px solid var(--color-neutral-300);
    border-radius: var(--radius-md);
    color: var(--color-neutral-700);
    cursor: pointer;
  }
  .btn-today:hover {
    background: var(--color-neutral-200);
  }

  .btn-group {
    display: flex;
    border: 1px solid var(--color-neutral-300);
    border-radius: var(--radius-md);
    overflow: hidden;
  }

  .btn-nav {
    background: var(--color-white);
    border: none;
    padding: 6px 14px;
    font-size: 16px;
    font-weight: 700;
    cursor: pointer;
    color: var(--color-neutral-700);
  }
  .btn-nav:hover {
    background: var(--color-neutral-100);
  }

  .weekdays-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    background: var(--color-neutral-100);
    border-radius: var(--radius-md) var(--radius-md) 0 0;
    border: 1px solid var(--color-neutral-200);
    border-bottom: none;
  }

  .weekday-cell {
    padding: 10px;
    text-align: center;
    font-size: 12px;
    font-weight: 700;
    color: var(--color-neutral-600);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .days-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    border: 1px solid var(--color-neutral-200);
    border-radius: 0 0 var(--radius-md) var(--radius-md);
    overflow: hidden;
  }

  .day-cell {
    min-height: 110px;
    background: var(--color-white);
    border-right: 1px solid var(--color-neutral-200);
    border-bottom: 1px solid var(--color-neutral-200);
    padding: 6px;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    transition: background 0.15s ease;
  }

  .day-cell:nth-child(7n) {
    border-right: none;
  }

  .day-cell.other-month {
    background: var(--color-neutral-50);
    opacity: 0.6;
  }

  .day-cell.today {
    background: rgba(var(--color-primary-500-rgb, 59, 130, 246), 0.04);
  }

  .day-number-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }

  .day-number {
    font-size: 12px;
    font-weight: 700;
    color: var(--color-neutral-700);
  }

  .today-badge {
    font-size: 10px;
    font-weight: 700;
    background: var(--color-primary-600);
    color: var(--color-white);
    padding: 1px 6px;
    border-radius: 10px;
  }

  .events-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    overflow-y: auto;
    max-height: 80px;
  }

  .event-pill {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    padding: 3px 6px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    text-align: left;
    border: none;
    cursor: pointer;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: transform 0.1s ease, filter 0.15s ease;
  }

  .event-pill:hover {
    transform: scale(1.02);
    filter: brightness(0.95);
  }

  .event-time {
    font-weight: 700;
    font-size: 10px;
    opacity: 0.85;
    white-space: nowrap;
  }

  .event-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Status Colors */
  .status-planned {
    background: #e0f2fe;
    color: #0369a1;
  }

  .status-progress {
    background: #fef3c7;
    color: #b45309;
  }

  .status-completed {
    background: #dcfce7;
    color: #15803d;
  }

  .status-canceled {
    background: #f3f4f6;
    color: #6b7280;
  }
</style>
