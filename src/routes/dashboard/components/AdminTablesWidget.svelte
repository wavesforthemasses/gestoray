<script lang="ts">
  import AdminTasks from '$lib/components/Dashboard/AdminTasks.svelte';

  interface Props {
    loadingAdminTables?: boolean;
    adminPendingContracts?: any[];
    adminOverdueInstallments?: any[];
    adminPendingCommissions?: any[];
    adminFinalizedCommissions?: any[];
    adminUndistributedPayments?: any[];
    onMarkCommissionPaid?: (id: string) => void;
    hasContracts?: boolean;
    hasPayments?: boolean;
    hasCommissions?: boolean;
  }

  let {
    loadingAdminTables = false,
    adminPendingContracts = [],
    adminOverdueInstallments = [],
    adminPendingCommissions = [],
    adminFinalizedCommissions = [],
    adminUndistributedPayments = [],
    onMarkCommissionPaid = () => {},
    hasContracts = false,
    hasPayments = false,
    hasCommissions = false
  }: Props = $props();
</script>

<div class="admin-tables-widget">
  {#if loadingAdminTables}
    <div class="loader-box">
      <span class="spinner"></span>
      Caricamento compiti amministrativi...
    </div>
  {:else}
    <AdminTasks 
      {adminPendingContracts}
      {adminOverdueInstallments}
      {adminUndistributedPayments}
      {adminPendingCommissions}
      {adminFinalizedCommissions}
      {onMarkCommissionPaid}
      {hasContracts}
      {hasPayments}
      {hasCommissions}
    />
  {/if}
</div>

<style>
  .admin-tables-widget {
    margin-top: 24px;
  }
</style>
