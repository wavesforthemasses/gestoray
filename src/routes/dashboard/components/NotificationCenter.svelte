<script lang="ts">
  import { onMount } from 'svelte';
  import { Bell, Check } from '@lucide/svelte';
  import { NotificationsService, type AppNotification } from '$lib/services/notificationsService';
  import { authState } from '$lib/auth.svelte';

  let notifications = $state<AppNotification[]>([]);
  let showDropdown = $state(false);

  const currentUserUid = $derived(authState.user?.uid || '');
  const unreadCount = $derived(notifications.filter(n => !n.read).length);

  $effect(() => {
    const uid = currentUserUid;
    if (!uid) return;
    const unsub = NotificationsService.listenUserNotifications(uid, (items) => {
      notifications = items;
    });
    return () => unsub();
  });

  async function handleMarkRead(id: string) {
    await NotificationsService.markAsRead(id);
  }
</script>

<div class="notification-center-wrap">
  <button 
    class="bell-btn" 
    onclick={() => showDropdown = !showDropdown} 
    aria-label="Notifiche"
    title="Centro Notifiche"
  >
    <Bell size={20} />
    {#if unreadCount > 0}
      <span class="badge-count">{unreadCount > 9 ? '9+' : unreadCount}</span>
    {/if}
  </button>

  {#if showDropdown}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="dropdown-backdrop" onclick={() => showDropdown = false}></div>
    <div class="notifications-dropdown">
      <div class="dropdown-header">
        <h4><Bell size={16} class="bell-icon" /> Notifiche ({unreadCount} non lette)</h4>
      </div>

      <div class="dropdown-body">
        {#if notifications.length === 0}
          <div class="empty-notif">Nessuna notifica presente</div>
        {:else}
          {#each notifications as item (item.id)}
            <div class="notif-item" class:unread={!item.read}>
              <div class="notif-content">
                <strong>{item.title}</strong>
                <p>{item.message}</p>
                <small>{new Date(item.createdAt).toLocaleString('it-IT')}</small>
              </div>
              {#if !item.read}
                <button onclick={() => handleMarkRead(item.id)} class="btn-read" title="Segna come letta">
                  <Check size={14} />
                </button>
              {/if}
            </div>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .notification-center-wrap { position: relative; display: inline-block; }
  .bell-btn { background: transparent; border: none; cursor: pointer; padding: 8px; border-radius: var(--radius-md); color: var(--color-neutral-600); position: relative; display: flex; align-items: center; justify-content: center; }
  .bell-btn:hover { background: var(--color-neutral-100); color: var(--color-neutral-900); }
  .badge-count { position: absolute; top: 2px; right: 2px; background: var(--color-error, #ef4444); color: white; font-size: 10px; font-weight: 700; padding: 1px 5px; border-radius: 99px; min-width: 14px; text-align: center; }
  .dropdown-backdrop { position: fixed; inset: 0; z-index: 900; }
  .notifications-dropdown { position: absolute; right: 0; top: 40px; width: 320px; max-height: 400px; background: white; border: 1px solid var(--color-neutral-200); border-radius: var(--radius-lg); box-shadow: var(--shadow-xl); z-index: 901; overflow: hidden; display: flex; flex-direction: column; }
  .dropdown-header { padding: 12px 16px; border-bottom: 1px solid var(--color-neutral-200); background: var(--color-neutral-50); }
  .dropdown-header h4 { margin: 0; font-size: 14px; color: var(--color-neutral-800); }
  .dropdown-body { overflow-y: auto; flex: 1; }
  .empty-notif { padding: 24px; text-align: center; color: var(--color-neutral-500); font-size: 13px; }
  .notif-item { padding: 12px 16px; border-bottom: 1px solid var(--color-neutral-100); display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
  .notif-item.unread { background: var(--color-primary-50, #eff6ff); }
  .notif-content strong { font-size: 13px; color: var(--color-neutral-900); display: block; margin-bottom: 2px; }
  .notif-content p { margin: 0; font-size: 12px; color: var(--color-neutral-600); }
  .notif-content small { font-size: 11px; color: var(--color-neutral-400); margin-top: 4px; display: block; }
  .btn-read { background: transparent; border: none; cursor: pointer; color: var(--color-primary-600); padding: 4px; border-radius: 4px; }
</style>
