<script lang="ts">
  import type { PlaceDocument } from '../../domain/models/place';
  import { 
    MapPin, 
    Building2, 
    Warehouse, 
    Store, 
    Phone, 
    Mail, 
    User, 
    Eye, 
    Pencil, 
    Navigation,
    Layers,
    ShieldAlert
  } from '@lucide/svelte';

  interface Props {
    place: PlaceDocument;
    isSelected?: boolean;
    onSelect?: (place: PlaceDocument) => void;
  }

  let {
    place,
    isSelected = false,
    onSelect
  }: Props = $props();

  const primaryContact = $derived(
    place.contacts.find(c => c.isPrimary) || place.contacts[0] || null
  );

  function getTypeBadge(type: string) {
    switch (type) {
      case 'warehouse':
        return { label: 'Magazzino', icon: Warehouse, color: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'headquarters':
        return { label: 'Sede Legale', icon: Building2, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' };
      case 'branch':
        return { label: 'Filiale', icon: Building2, color: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'store':
        return { label: 'Showroom', icon: Store, color: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'site':
      default:
        return { label: 'Cantiere', icon: MapPin, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    }
  }
</script>

<div 
  class="place-card {isSelected ? 'selected' : ''}"
  onclick={() => onSelect?.(place)}
  role="button"
  tabindex="0"
  onkeydown={(e) => { if (e.key === 'Enter') onSelect?.(place); }}
>
  <!-- Card Header -->
  <div class="card-top-row">
    <div class="types-badges">
      {#each (place.types || ['site']) as type}
        {@const badge = getTypeBadge(type)}
        {@const IconComp = badge.icon}
        <span class="type-pill">
          <IconComp size={12} />
          <span>{badge.label}</span>
        </span>
      {/each}
    </div>

    <span class="status-badge status-{place.status}">
      {place.status === 'active' || place.status === 'attivo' ? 'Attivo' : place.status}
    </span>
  </div>

  <!-- Title and Code -->
  <div class="card-body">
    <h3 class="place-title">{place.name}</h3>
    {#if place.code}
      <div class="code-pill">
        <span>{place.code}</span>
      </div>
    {/if}

    <!-- Address -->
    <div class="info-row">
      <MapPin size={15} class="info-icon text-blue-600" />
      <span class="address-text">
        {place.summary?.shortAddress || place.address?.formattedAddress || 'Indirizzo non specificato'}
      </span>
    </div>

    <!-- Client -->
    {#if place.clientName}
      <div class="info-row">
        <User size={15} class="info-icon text-slate-400" />
        <span class="client-text">{place.clientName}</span>
      </div>
    {/if}

    <!-- Primary Contact -->
    {#if primaryContact}
      <div class="contact-box">
        <div class="contact-header">
          <span class="contact-role">{primaryContact.role || 'Referente'}</span>
          <span class="contact-name">{primaryContact.name}</span>
        </div>
        <div class="contact-channels">
          {#if primaryContact.phone}
            <a href="tel:{primaryContact.phone}" class="contact-link" onclick={(e) => e.stopPropagation()}>
              <Phone size={13} />
              <span>{primaryContact.phone}</span>
            </a>
          {/if}
          {#if primaryContact.email}
            <a href="mailto:{primaryContact.email}" class="contact-link" onclick={(e) => e.stopPropagation()}>
              <Mail size={13} />
              <span>{primaryContact.email}</span>
            </a>
          {/if}
        </div>
      </div>
    {/if}

    <!-- Geofence & Hierarchy details -->
    <div class="card-meta-row">
      {#if place.geo?.radiusMeters}
        <span class="meta-tag">
          <Navigation size={12} />
          <span>Radar {place.geo.radiusMeters}m</span>
        </span>
      {/if}
      {#if place.depth > 0}
        <span class="meta-tag">
          <Layers size={12} />
          <span>Livello {place.depth}</span>
        </span>
      {/if}
    </div>
  </div>

  <!-- Card Footer Actions -->
  <div class="card-footer" onclick={(e) => e.stopPropagation()} role="group">
    <a href="/dashboard/places/{place.id}" class="btn-card-action primary">
      <Eye size={14} />
      <span>Dettaglio</span>
    </a>
    <a href="/dashboard/places/{place.id}/edit" class="btn-card-action secondary">
      <Pencil size={14} />
      <span>Modifica</span>
    </a>
  </div>
</div>

<style>
  .place-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.02);
    transition: all 0.2s ease;
    cursor: pointer;
  }

  .place-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 16px rgba(0, 0, 0, 0.05);
    border-color: #cbd5e1;
  }

  .place-card.selected {
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
  }

  .card-top-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .types-badges {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .type-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: #f1f5f9;
    color: #334155;
    border: 1px solid #e2e8f0;
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 12px;
  }

  .status-badge {
    font-size: 11px;
    font-weight: 600;
    padding: 2px 8px;
    border-radius: 12px;
    text-transform: capitalize;
  }

  .status-active, .status-attivo {
    background: #dcfce7;
    color: #166534;
  }

  .status-archived, .status-inattivo {
    background: #f1f5f9;
    color: #64748b;
  }

  .status-temporary {
    background: #fef9c3;
    color: #854d0e;
  }

  .place-title {
    font-size: 16px;
    font-weight: 700;
    color: #0f172a;
    margin: 0;
    line-height: 1.3;
  }

  .code-pill {
    display: inline-block;
    font-size: 11px;
    font-weight: 700;
    color: #2563eb;
    background: #eff6ff;
    padding: 2px 6px;
    border-radius: 4px;
    margin-top: 4px;
    margin-bottom: 8px;
  }

  .info-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 13px;
    color: #475569;
    margin-bottom: 4px;
  }

  .info-icon {
    flex-shrink: 0;
    margin-top: 2px;
  }

  .address-text {
    line-height: 1.4;
  }

  .client-text {
    font-weight: 500;
  }

  .contact-box {
    background: #f8fafc;
    border: 1px solid #f1f5f9;
    border-radius: 8px;
    padding: 8px 10px;
    margin-top: 6px;
  }

  .contact-header {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 4px;
  }

  .contact-role {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    color: #64748b;
  }

  .contact-name {
    font-size: 12px;
    font-weight: 600;
    color: #1e293b;
  }

  .contact-channels {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .contact-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    color: #2563eb;
    text-decoration: none;
  }

  .contact-link:hover {
    text-decoration: underline;
  }

  .card-meta-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
  }

  .meta-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 600;
    color: #64748b;
    background: #f1f5f9;
    padding: 2px 6px;
    border-radius: 6px;
  }

  .card-footer {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: auto;
    padding-top: 10px;
    border-top: 1px solid #f1f5f9;
  }

  .btn-card-action {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 7px 10px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.15s ease;
  }

  .btn-card-action.primary {
    background: #eff6ff;
    color: #1d4ed8;
    border: 1px solid #bfdbfe;
  }

  .btn-card-action.primary:hover {
    background: #dbeafe;
  }

  .btn-card-action.secondary {
    background: #f8fafc;
    color: #475569;
    border: 1px solid #e2e8f0;
  }

  .btn-card-action.secondary:hover {
    background: #f1f5f9;
    color: #0f172a;
  }
</style>
