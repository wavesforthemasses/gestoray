<script lang="ts">
  import type { ActivityItem, ActivityStatus } from '../schema';
  import { goto } from '$app/navigation';
  import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus } from '@lucide/svelte';

  interface Props {
    activities: ActivityItem[];
  }

  let { activities = [] }: Props = $props();

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

  let calendarDays = $derived.by(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const daysInMonth = lastDayOfMonth.getDate();
    const prevMonthLastDay = new Date(year, month, 0).getDate();

    const days: Array<{
      date: Date;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      dateString: string;
    }> = [];

    // Previous month padding
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

    // Next month padding
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

  function getActivitiesForDate(dateStr: string): ActivityItem[] {
    return activities.filter(a => {
      const actDate = (a.dueDate || a.executionDate || a.createdAt || '').split('T')[0];
      return actDate === dateStr;
    });
  }

  function getStatusClass(status: ActivityStatus): string {
    switch (status) {
      case 'completato':
      case 'completata': return 'status-completed';
      case 'in_corso': return 'status-in-progress';
      case 'da_fare': return 'status-todo';
      case 'annullato': return 'status-cancelled';
      default: return 'status-todo';
    }
  }

  function getPriorityDotClass(priority: string): string {
    switch (priority) {
      case 'urgente': return 'prio-dot-red';
      case 'alta': return 'prio-dot-orange';
      case 'media': return 'prio-dot-blue';
      case 'bassa': return 'prio-dot-green';
      default: return 'prio-dot-blue';
    }
  }
</script>

<div class="calendar-container animate-fade-in">
  <div class="calendar-toolbar">
    <div class="month-navigation">
      <div class="month-title">
        <CalendarIcon size={20} class="calendar-icon" />
        <h3>{currentMonthName} {currentYear}</h3>
      </div>
      <div class="nav-buttons">
        <button type="button" class="btn-nav" onclick={prevMonth} title="Mese precedente">
          <ChevronLeft size={18} />
        </button>
        <button type="button" class="btn-today" onclick={goToToday}>
          Oggi
        </button>
        <button type="button" class="btn-nav" onclick={nextMonth} title="Mese successivo">
          <ChevronRight size={18} />
        </button>
      </div>
    </div>

    <div class="calendar-legend">
      <div class="legend-item"><span class="legend-dot status-todo"></span> Da Fare</div>
      <div class="legend-item"><span class="legend-dot status-in-progress"></span> In Corso</div>
      <div class="legend-item"><span class="legend-dot status-completed"></span> Completato</div>
    </div>
  </div>

  <div class="calendar-grid">
    <div class="weekdays-row">
      {#each daysOfWeek as day}
        <div class="weekday-header">{day}</div>
      {/each}
    </div>

    <div class="days-grid">
      {#each calendarDays as day}
        {@const dayActivities = getActivitiesForDate(day.dateString)}
        <div 
          class="day-cell" 
          class:other-month={!day.isCurrentMonth}
          class:today={day.isToday}
        >
          <div class="day-header">
            <span class="day-number" class:today-num={day.isToday}>{day.dayNumber}</span>
            <a 
              href={`/dashboard/activities/add?date=${day.dateString}`} 
              class="add-day-btn" 
              title="Aggiungi attività in questa data"
            >
              <Plus size={12} />
            </a>
          </div>

          <div class="day-activities">
            {#each dayActivities.slice(0, 3) as act}
              <button 
                type="button" 
                class={`activity-pill ${getStatusClass(act.status)}`}
                onclick={() => act.id && goto(`/dashboard/activities/${act.id}`)}
                title={`${act.title} - ${act.assignedName || 'Non assegnato'}`}
              >
                <span class={`prio-dot ${getPriorityDotClass(act.priority)}`}></span>
                <span class="act-title">{act.title}</span>
              </button>
            {/each}

            {#if dayActivities.length > 3}
              <div class="more-activities-badge">
                +{dayActivities.length - 3} altre
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .calendar-container {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-200);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
    margin-top: 16px;
  }

  .calendar-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px;
    background: var(--color-neutral-50);
    border-bottom: 1px solid var(--color-neutral-200);
    flex-wrap: wrap;
    gap: 16px;
  }

  .month-navigation {
    display: flex;
    align-items: center;
    gap: 20px;
  }

  .month-title {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .month-title h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 700;
    color: var(--color-neutral-800);
  }

  :global(.calendar-icon) {
    color: var(--color-primary-600);
  }

  .nav-buttons {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .btn-nav {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-300);
    border-radius: var(--radius-sm);
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: var(--color-neutral-700);
    transition: all 0.15s ease;
  }

  .btn-nav:hover {
    background: var(--color-neutral-100);
    border-color: var(--color-neutral-400);
  }

  .btn-today {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-300);
    border-radius: var(--radius-sm);
    padding: 0 12px;
    height: 32px;
    font-size: 13px;
    font-weight: 600;
    color: var(--color-neutral-700);
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-today:hover {
    background: var(--color-neutral-100);
    border-color: var(--color-neutral-400);
  }

  .calendar-legend {
    display: flex;
    align-items: center;
    gap: 16px;
    font-size: 13px;
    color: var(--color-neutral-600);
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    display: inline-block;
  }

  .calendar-grid {
    display: flex;
    flex-direction: column;
    width: 100%;
  }

  .weekdays-row {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    background: var(--color-neutral-100);
    border-bottom: 1px solid var(--color-neutral-200);
  }

  .weekday-header {
    padding: 10px;
    text-align: center;
    font-weight: 700;
    font-size: 12px;
    color: var(--color-neutral-600);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .days-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    grid-auto-rows: minmax(110px, auto);
  }

  .day-cell {
    border-right: 1px solid var(--color-neutral-200);
    border-bottom: 1px solid var(--color-neutral-200);
    padding: 6px;
    background: var(--color-white);
    display: flex;
    flex-direction: column;
    gap: 4px;
    transition: background 0.15s ease;
    min-height: 110px;
  }

  .day-cell:nth-child(7n) {
    border-right: none;
  }

  .day-cell.other-month {
    background: var(--color-neutral-50);
    opacity: 0.6;
  }

  .day-cell.today {
    background: #eff6ff;
  }

  .day-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 2px 4px;
  }

  .day-number {
    font-size: 13px;
    font-weight: 600;
    color: var(--color-neutral-700);
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
  }

  .day-number.today-num {
    background: var(--color-primary-600);
    color: var(--color-white);
    font-weight: 700;
  }

  .add-day-btn {
    opacity: 0;
    width: 20px;
    height: 20px;
    border-radius: 4px;
    background: var(--color-primary-100);
    color: var(--color-primary-700);
    display: flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    transition: all 0.15s ease;
  }

  .day-cell:hover .add-day-btn {
    opacity: 1;
  }

  .add-day-btn:hover {
    background: var(--color-primary-600);
    color: var(--color-white);
  }

  .day-activities {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1;
  }

  .activity-pill {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 3px 6px;
    border-radius: 4px;
    font-size: 11px;
    border: none;
    text-align: left;
    cursor: pointer;
    width: 100%;
    overflow: hidden;
    white-space: nowrap;
    transition: transform 0.1s ease;
  }

  .activity-pill:hover {
    transform: scale(1.02);
  }

  .prio-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .prio-dot-red { background: #ef4444; }
  .prio-dot-orange { background: #f97316; }
  .prio-dot-blue { background: #3b82f6; }
  .prio-dot-green { background: #10b981; }

  .act-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
  }

  /* Status Colors */
  .status-todo {
    background: #fef3c7;
    color: #92400e;
  }

  .status-in-progress {
    background: #dbeafe;
    color: #1e40af;
  }

  .status-completed {
    background: #d1fae5;
    color: #065f46;
  }

  .status-cancelled {
    background: #f3f4f6;
    color: #6b7280;
  }

  .more-activities-badge {
    font-size: 10px;
    font-weight: 700;
    color: var(--color-neutral-500);
    padding: 1px 4px;
    text-align: right;
  }
</style>
