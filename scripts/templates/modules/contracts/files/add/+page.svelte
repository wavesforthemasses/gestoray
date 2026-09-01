<script lang="ts">
  import { projectStore } from '$lib/stores/project';
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { NavigationService } from '$lib/services/navigationService';
  import { menuConfigStore } from '$lib/stores/menu';
  import { Card } from '$lib';
  import { ContractsService } from '../contracts.service';
  import { ContractSettingsService } from '../contractSettingsService';
  import type { ContractType, RecurringFrequency, ContractStatus, ContractProductItem, ContractSettings } from '../schema';
  import { CustomFieldsService } from '$lib/services/customFieldsService';
  import { CacheLookupService } from '$lib/services/cacheLookupService';
  import type { CustomFieldDefinition, CustomFieldValues } from '$lib/types/customFields';
  import CustomFieldsRenderer from '$lib/components/CustomFieldsRenderer.svelte';
  import { toast } from '$lib/stores/toast.svelte';
  import { FileText, List, AlertTriangle } from '@lucide/svelte';
  import { authState } from '$lib/auth.svelte';

  import ContractHeaderSection from '../components/ContractHeaderSection.svelte';
  import ContractDatesSection from '../components/ContractDatesSection.svelte';
  import ContractItemsSection from '../components/ContractItemsSection.svelte';
  import ContractNotesSection from '../components/ContractNotesSection.svelte';

  function parsePriceNumber(val: any): number {
    if (val == null) return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    if (typeof val === 'string') {
      const cleaned = val.replace('€', '').replace(/\./g, '').replace(',', '.').trim();
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  }

  let settings = $state<ContractSettings>({
    entityNaming: 'contract',
    prefix: 'CTR-',
    includeYear: true,
    numberPadding: 4,
    lastNumber: 0,
    resetCounterAnnually: true
  });
  let labels = $derived(ContractSettingsService.getLabels(settings));

  let clients = $state<{ id: string; name: string }[]>([]);
  let clientOptions = $derived(clients.map(c => ({ id: c.id, label: c.name })));

  let agents = $state<{ id: string; name: string }[]>([]);
  let agentOptions = $derived(agents.map(a => ({ id: a.id, label: a.name })));

  let projects = $state<{ id: string; name: string; clientId?: string }[]>([]);
  let places = $state<{ id: string; name: string; clientId?: string }[]>([]);
  let hasProjectsModule = $state(false);
  let hasPlacesModule = $state(false);
  let projectLabel = $state('Progetto');
  let placeLabel = $state('Cantiere / Luogo');

  let filteredProjects = $derived.by(() => {
    if (!clientId) return projects;
    return projects.filter(p => !p.clientId || p.clientId === clientId);
  });

  let projectOptions = $derived(
    filteredProjects.map(p => ({ id: p.id, label: p.name }))
  );

  let filteredPlaces = $derived.by(() => {
    if (!clientId) return places;
    return places.filter(p => !p.clientId || p.clientId === clientId);
  });

  let placeOptions = $derived(
    filteredPlaces.map(p => ({ id: p.id, label: p.name }))
  );

  $effect(() => {
    if (placeId) {
      const currentPlace = places.find(p => p.id === placeId);
      if (currentPlace && currentPlace.clientId) {
        if (!clientId) {
          clientId = currentPlace.clientId;
        } else if (currentPlace.clientId !== clientId) {
          placeId = '';
        }
      }
    }
  });

  $effect(() => {
    if (projectId) {
      const currentProj = projects.find(p => p.id === projectId);
      if (currentProj && currentProj.clientId) {
        if (!clientId) {
          clientId = currentProj.clientId;
        } else if (currentProj.clientId !== clientId) {
          projectId = '';
        }
      }
    }
  });

  let productsCatalog = $state<any[]>([]);
  let productOptions = $derived(
    productsCatalog.map(p => {
      const price = parsePriceNumber(p.price ?? p.listPrice ?? p.unitPrice ?? p.priceSold);
      const unit = p.unit || 'pz';
      const priceTag = (Number(price) || 0) > 0 ? ` - € ${(Number(price) || 0).toFixed(2)} / ${unit}` : '';
      return {
        id: p.id,
        label: `${p.name || p.label || 'Articolo'}${priceTag}`
      };
    })
  );

  let customFieldsList = $state<CustomFieldDefinition[]>([]);
  let customFieldsValues = $state<CustomFieldValues>({});

  let loading = $state(true);
  let saving = $state(false);
  let errorMsg = $state('');

  // Form State
  let contractNumber = $state('');
  let title = $state('');
  let clientId = $state('');
  let agentId = $state('');
  let projectId = $state('');
  let placeId = $state('');
  let type = $state<ContractType>('Non Ricorrente');
  let billingFrequency = $state<RecurringFrequency>('mensile');
  let startDate = $state(new Date().toISOString().slice(0, 10));
  let endDate = $state(new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10));
  let status = $state<ContractStatus>('bozza');
  let notes = $state('');
  let clientNotes = $state('');
  let adminNotes = $state('');
  let termsAndConditions = $state('');
  let tags = $state<string[]>([]);


  // Totali e Sconti Documento
  let discountType = $state<'percent' | 'amount'>('percent');
  let discountValue = $state<number>(0);

  // Items State
  let items = $state<ContractProductItem[]>([]);
  let selectedProductId = $state('');
  let itemTitle = $state('');
  let itemDescription = $state('');
  let itemQty = $state<number>(1);
  let itemPriceSold = $state<number | undefined>(undefined);

  let availableTypes = $derived<ContractType[]>(
    settings.allowedTypes && settings.allowedTypes.length > 0
      ? settings.allowedTypes
      : ['Ricorrente', 'Non Ricorrente']
  );

  let showEndDate = $derived(
    type === 'Ricorrente' || (settings.nonRecurringEndDateMode !== 'hidden')
  );

  let isEndDateRequired = $derived(
    type === 'Ricorrente' || (settings.nonRecurringEndDateMode === 'required')
  );

  // Derived Totals
  let taxableAmount = $derived(
    items.reduce((sum, i) => sum + i.subtotal, 0)
  );

  let discountAmount = $derived(
    discountType === 'percent'
      ? (taxableAmount * (discountValue || 0)) / 100
      : (discountValue || 0)
  );

  let grandTotalAmount = $derived(
    Math.max(0, taxableAmount - discountAmount)
  );

  onMount(async () => {
    try {
      const [s, cList, uList, cf, nextNumPreview] = await Promise.all([
        ContractSettingsService.getSettings(),
        CacheLookupService.getLookup('clients'),
        CacheLookupService.getLookup('users'),
        CustomFieldsService.getFieldsForModule('contracts'),
        ContractsService.previewNextContractNumber()
      ]);
      settings = s;
      clients = cList;
      agents = uList;
      customFieldsList = cf;
      contractNumber = nextNumPreview;
      termsAndConditions = s.defaultTermsAndConditions || '';
      status = s.defaultInitialStatus || 'bozza';

      if (typeof window !== 'undefined') {
        const urlParams = new URLSearchParams(window.location.search);
        const paramClientId = urlParams.get('clientId');
        const paramProjectId = urlParams.get('projectId');
        const paramPlaceId = urlParams.get('placeId');
        if (paramClientId) clientId = paramClientId;
        if (paramProjectId) projectId = paramProjectId;
        if (paramPlaceId) placeId = paramPlaceId;
      }

      // Pre-compila l'agente commerciale con l'utente autenticato
      if (authState.user?.uid) {
        const foundAgent = uList.find(a => a.id === authState.user?.uid);
        if (foundAgent) {
          agentId = foundAgent.id;
        }
      }

      type = s.defaultType || (s.allowedTypes && s.allowedTypes.length > 0 ? s.allowedTypes[0] : 'Non Ricorrente');

      if ($menuConfigStore.some(m => m.id === 'products')) {
        try {
          const servicePath = '../../products/products.service';
          // @ts-ignore
          const mod = await import(/* @vite-ignore */ servicePath);
          if (mod?.ProductsService) {
            productsCatalog = mod.ProductsService.getSaleableProducts 
              ? await mod.ProductsService.getSaleableProducts() 
              : (await mod.ProductsService.getProducts()).filter((p: any) => p.canBeSold !== false && p.usageType !== 'purchase');
          } else {
            productsCatalog = await CacheLookupService.getLookup('products');
          }
        } catch (e) {
          console.warn('Fallback cache prodotti:', e);
          productsCatalog = await CacheLookupService.getLookup('products');
        }
      }

      try {
        const sPath = '../../projects/projects.service';
        const setPath = '../../projects/projectSettingsService';
        // @ts-ignore
        const modProj = await import(/* @vite-ignore */ sPath);
        // @ts-ignore
        const modSet = await import(/* @vite-ignore */ setPath);
        if (modProj?.ProjectsService && modSet?.ProjectSettingsService) {
          const [projectsList, settings] = await Promise.all([
            modProj.ProjectsService.getProjects(),
            modSet.ProjectSettingsService.getSettings()
          ]);
          projects = projectsList.map((c: any) => ({
            id: c.id!,
            name: `${c.code || ''} - ${c.name || ''}`.replace(/^ - /, ''),
            clientId: c.clientId
          }));
          projectLabel = modSet.ProjectSettingsService.getLabels(settings).singular;
          hasProjectsModule = true;
        } else {
          throw new Error('Projects module non disponibile');
        }
      } catch (e) {
        try {
          projects = await CacheLookupService.getLookup('projects');
          hasProjectsModule = projects.length > 0;
        } catch (err) {
          projects = [];
          hasProjectsModule = false;
        }
      }

      try {
        const plPath = '../../places/places.service';
        const plSetPath = '../../places/placeSettingsService';
        // @ts-ignore
        const modPl = await import(/* @vite-ignore */ plPath);
        // @ts-ignore
        const modPlSet = await import(/* @vite-ignore */ plSetPath);
        if (modPl?.PlacesService && modPlSet?.PlaceSettingsService) {
          const [placesList, pSettings] = await Promise.all([
            modPl.PlacesService.getPlaces(),
            modPlSet.PlaceSettingsService.getSettings()
          ]);
          places = placesList.map((c: any) => ({
            id: c.id!,
            name: `${c.code || ''} - ${c.name || ''}`.replace(/^ - /, ''),
            clientId: c.clientId
          }));
          placeLabel = modPlSet.PlaceSettingsService.getLabels(pSettings).singular;
          hasPlacesModule = true;
        } else {
          throw new Error('Places module non disponibile');
        }
      } catch (e) {
        try {
          places = await CacheLookupService.getLookup('places');
          hasPlacesModule = places.length > 0;
        } catch (err) {
          places = [];
          hasPlacesModule = false;
        }
      }
    } catch (e) {
      console.error('Errore caricamento dati creazione:', e);
    } finally {
      loading = false;
    }
  });

  function handleProductSelectChange(prodId: string) {
    selectedProductId = prodId;
    const found = productsCatalog.find(p => p.id === prodId);
    if (found) {
      itemTitle = found.name || found.label || '';
      itemDescription = found.description || '';
      itemPriceSold = parsePriceNumber(found.price ?? found.listPrice ?? found.unitPrice ?? found.priceSold);
    }
  }

  function handleAddItem() {
    if (!selectedProductId) {
      toast.error('Seleziona un articolo dal catalogo');
      return;
    }

    const found = productsCatalog.find(p => p.id === selectedProductId);
    const productName = itemTitle.trim() || found?.name || 'Articolo';
    const description = itemDescription.trim() || found?.description || '';
    const unit = found?.unit || 'pz';
    const listPrice = parsePriceNumber(found?.price ?? found?.listPrice ?? found?.unitPrice ?? 0);
    const minPrice = parsePriceNumber(found?.minPrice ?? 0);

    if (itemPriceSold === undefined || isNaN(itemPriceSold)) {
      itemPriceSold = listPrice;
    }

    const subtotal = (itemQty || 1) * itemPriceSold;
    const minRes = ContractsService.calculateMinimoFatturabilePrice(itemQty, itemPriceSold, found?.minimoFatturabile);
    const minimoFatturabileText = minRes.isMinimoApplied ? minRes.note : undefined;

    items = [
      ...items,
      {
        productId: selectedProductId,
        productName,
        description,
        unit,
        listPrice,
        minPrice,
        priceSold: itemPriceSold,
        quantity: itemQty,
        subtotal,
        minimoFatturabileText
      }
    ];

    selectedProductId = '';
    itemTitle = '';
    itemDescription = '';
    itemQty = 1;
    itemPriceSold = undefined;
  }

  function handleRemoveItem(index: number) {
    items = items.filter((_, i) => i !== index);
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!clientId) {
      toast.error('Seleziona un cliente intestatario obbligatorio');
      return;
    }

    saving = true;
    errorMsg = '';

    try {
      const selectedClient = clients.find(c => c.id === clientId);
      const selectedAgent = agents.find(a => a.id === agentId);
      const selectedProject = projects.find(p => p.id === projectId);
      const selectedPlace = places.find(p => p.id === placeId);

      const contractId = await ContractsService.createContract({
        contractNumber: '',
        title: title.trim(),
        clientId,
        clientName: selectedClient ? selectedClient.name : 'Cliente',
        agentId: agentId || undefined,
        agentName: selectedAgent ? selectedAgent.name : undefined,
        projectId: projectId || undefined,
        projectName: selectedProject ? selectedProject.name : undefined,
        placeId: placeId || undefined,
        placeName: selectedPlace ? selectedPlace.name : undefined,
        type,
        billingFrequency,
        startDate,
        endDate,
        status,
        notes: notes.trim(),
        clientNotes: clientNotes.trim(),
        adminNotes: adminNotes.trim(),
        termsAndConditions: termsAndConditions.trim(),
        tags,
        items,
        taxableAmount,
        discountType,
        discountValue,
        discountAmount,
        totalAmount: grandTotalAmount,
        customFields: customFieldsValues
      });

      toast.success(`${labels.singular} creato con successo!`);
      await NavigationService.submitSuccessReturn($page.url.searchParams, `/dashboard/contracts/${contractId}`);
    } catch (err: any) {
      console.error('Errore salvataggio:', err);
      errorMsg = err.message || `Errore durante la creazione del ${labels.singular.toLowerCase()}.`;
    } finally {
      saving = false;
    }
  }
</script>

<svelte:head>
  <title>{labels.newSingular} | {$projectStore?.projectName || 'ERP'}</title>
</svelte:head>

<div class="add-contract-container animate-fade-in">
  {#if loading}
    <div class="loader-box">
      <span class="spinner"></span>
      Caricamento in corso...
    </div>
  {:else}
    <Card
      title={labels.newSingular}
      description={`Compila le informazioni di seguito per generare un nuovo ${labels.singular.toLowerCase()}.`}
      class="form-card"
    >
      {#snippet icon()}
        <FileText size={20} class="icon-accent" />
      {/snippet}

      {#snippet headerSnippet()}
        <a 
          href="/dashboard/contracts" 
          class="btn-module-list" 
          title="Vai all'elenco {labels.plural}"
          aria-label="Vai all'elenco {labels.plural}"
        >
          <List size={20} />
        </a>
      {/snippet}

      {#if errorMsg}
        <div class="alert error-box">
          <AlertTriangle size={18} /> {errorMsg}
        </div>
      {/if}

      <form onsubmit={handleSubmit} class="contract-form-grid">
        <!-- 1. Header Section -->
        <ContractHeaderSection
          {labels}
          {clientOptions}
          {agentOptions}
          {projectOptions}
          {placeOptions}
          {hasProjectsModule}
          {hasPlacesModule}
          {projectLabel}
          {placeLabel}
          bind:clientId
          bind:title
          bind:agentId
          bind:contractNumber
          bind:projectId
          bind:placeId
        />

        <!-- 2. Dates & Status Section -->
        <ContractDatesSection
          {labels}
          {availableTypes}
          {showEndDate}
          {isEndDateRequired}
          bind:type
          bind:status
          bind:billingFrequency
          bind:startDate
          bind:endDate
          bind:tags
        />

        <!-- 3. Items & Totals Section -->
        <ContractItemsSection
          {productOptions}
          bind:items
          bind:selectedProductId
          bind:itemTitle
          bind:itemDescription
          bind:itemQty
          bind:itemPriceSold
          bind:discountType
          bind:discountValue
          {taxableAmount}
          {discountAmount}
          {grandTotalAmount}
          onProductSelectChange={handleProductSelectChange}
          onAddItem={handleAddItem}
          onRemoveItem={handleRemoveItem}
        />

        <!-- 4. Notes & Terms Section -->
        <ContractNotesSection
          bind:clientNotes
          bind:adminNotes
          bind:termsAndConditions
        />

        <!-- 5. Custom Fields (Dynamic) -->
        {#if customFieldsList.length > 0}
          <div class="custom-fields-wrapper">
            <CustomFieldsRenderer fields={customFieldsList} bind:values={customFieldsValues} />
          </div>
        {/if}

        <!-- Submit Button -->
        <button type="submit" class="save-btn" disabled={saving}>
          {#if saving}
            Salvataggio in corso...
          {:else}
            Crea Nuovo {labels.singular}
          {/if}
        </button>
      </form>
    </Card>
  {/if}
</div>

<style>
  .add-contract-container {
    width: 100%;
  }

  :global(.icon-accent) {
    color: var(--color-primary-500);
  }

  .back-link {
    background: var(--color-white);
    border: 1px solid var(--color-neutral-300);
    color: var(--color-neutral-600);
    padding: 8px 14px;
    border-radius: var(--radius-sm);
    text-decoration: none;
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    width: fit-content;
  }

  .back-link:hover {
    background: var(--color-neutral-100);
    color: var(--color-neutral-800);
  }

  .contract-form-grid {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .save-btn {
    background: linear-gradient(135deg, var(--color-primary-500), var(--color-primary-600));
    color: var(--color-white);
    padding: 14px;
    border: none;
    border-radius: var(--radius-md);
    font-family: inherit;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity var(--transition-fast);
    box-shadow: 0 4px 12px hsla(var(--brand-h), var(--brand-s), var(--brand-l), 0.2);
    margin-top: 8px;
  }

  .save-btn:hover:not(:disabled) {
    opacity: 0.95;
  }

  .save-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    box-shadow: none;
  }

  .loader-box {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 40px;
    color: var(--color-neutral-500);
    font-size: 14px;
  }

  .alert.error-box {
    background: var(--color-error-light, #fee2e2);
    color: var(--color-error-text, #991b1b);
    border: 1px solid var(--color-error-border, #fca5a5);
    padding: 12px 16px;
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
  }
</style>
