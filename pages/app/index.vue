<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
useHead({ title: 'Painel · Quodra' })

type LinkRow = {
  id: string
  slug: string
  url: string
  projectId: string
  projectName: string | null
  label: string | null
  hasPassword: boolean
  isPublic: boolean
  triageEnabled: boolean
  active: boolean
  viewCount: number
  lastViewedAt: string | null
}
type LinksResponse = { links: LinkRow[] }

const { data, refresh, pending } = await useFetch<LinksResponse>('/api/links', {
  server: false,
  lazy: true,
})

const stats = computed(() => {
  const links = data.value?.links ?? []
  return { total: links.length, active: links.filter((l) => l.active).length }
})

// ── New link modal ───────────────────────────────────────────────────────────
type Project = { id: string; name: string }
const showModal = ref(false)
const projects = ref<Project[]>([])
const projectsLoading = ref(false)
const projectsError = ref('')

const form = reactive({
  projectId: '',
  label: '',
  password: '',
  isPublic: false,
  allowPublicTriage: false,
  // Client-facing visibility + white-label
  hiddenLabels: '',
  hideEstimate: false,
  hideAssignee: false,
  hideDueDate: false,
  hidePriority: false,
  clientName: '',
  clientLogoUrl: '',
})
const showAdvanced = ref(false)
const creating = ref(false)
const createError = ref('')

async function openModal() {
  showModal.value = true
  createError.value = ''
  if (projects.value.length) return
  projectsLoading.value = true
  projectsError.value = ''
  try {
    projects.value = await $fetch<Project[]>('/api/projects')
  } catch (e: unknown) {
    projectsError.value =
      (e as { data?: { message?: string } })?.data?.message ?? 'Não foi possível carregar os projetos'
  } finally {
    projectsLoading.value = false
  }
}

function closeModal() {
  showModal.value = false
  showAdvanced.value = false
  Object.assign(form, {
    projectId: '', label: '', password: '', isPublic: false, allowPublicTriage: false,
    hiddenLabels: '', hideEstimate: false, hideAssignee: false, hideDueDate: false,
    hidePriority: false, clientName: '', clientLogoUrl: '',
  })
}

const canSubmit = computed(
  () => form.projectId && (form.isPublic || form.password) && !creating.value
)

async function createLink() {
  if (!canSubmit.value) return
  creating.value = true
  createError.value = ''
  const project = projects.value.find((p) => p.id === form.projectId)
  try {
    await $fetch('/api/links', {
      method: 'POST',
      body: {
        projectId: form.projectId,
        projectName: project?.name ?? null,
        label: form.label,
        password: form.isPublic ? '' : form.password,
        isPublic: form.isPublic,
        allowPublicTriage: form.allowPublicTriage,
        hiddenLabels: form.hiddenLabels,
        hideEstimate: form.hideEstimate,
        hideAssignee: form.hideAssignee,
        hideDueDate: form.hideDueDate,
        hidePriority: form.hidePriority,
        clientName: form.clientName,
        clientLogoUrl: form.clientLogoUrl,
      },
    })
    closeModal()
    await refresh()
  } catch (e: unknown) {
    const err = e as { data?: { message?: string } }
    createError.value = err.data?.message ?? 'Não foi possível criar o link'
  } finally {
    creating.value = false
  }
}

// ── Row actions ──────────────────────────────────────────────────────────────
const copiedId = ref<string | null>(null)
async function copyUrl(link: LinkRow) {
  try {
    await navigator.clipboard.writeText(link.url)
    copiedId.value = link.id
    setTimeout(() => (copiedId.value = null), 1500)
  } catch {
    /* clipboard blocked; ignore */
  }
}

const rowBusy = ref<string | null>(null)
async function deleteLink(link: LinkRow) {
  if (!confirm(`Excluir "${link.label || link.projectName || 'este link'}" para sempre? O link para de funcionar e não dá pra desfazer.`)) return
  rowBusy.value = link.id
  try {
    await $fetch(`/api/links/${link.id}?permanent=1`, { method: 'DELETE' })
    await refresh()
  } catch {
    /* surfaced by refresh */
  } finally {
    rowBusy.value = null
  }
}

async function toggleActive(link: LinkRow) {
  rowBusy.value = link.id
  try {
    if (link.active) {
      await $fetch(`/api/links/${link.id}`, { method: 'DELETE' })
    } else {
      await $fetch(`/api/links/${link.id}`, { method: 'PATCH', body: { active: true } })
    }
    await refresh()
  } catch {
    /* surfaced by refresh state; keep simple */
  } finally {
    rowBusy.value = null
  }
}
</script>

<template>
  <div class="min-h-screen bg-[#fbfaf7] text-[#1b1815] font-sans antialiased">
    <!-- top bar -->
    <header class="sticky top-0 z-30 border-b border-[#e5dfd5] bg-[#fbfaf7]/85 backdrop-blur-md">
      <div class="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
        <NuxtLink to="/app" class="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-[#1b1815]">
          <img src="/logo.svg" alt="Quodra" class="h-7 w-7" />
          Quodra
        </NuxtLink>
        <a
          href="/auth/logout"
          aria-label="Sair"
          title="Sair"
          class="flex h-9 w-9 items-center justify-center rounded-lg border border-[#e5dfd5] text-[#6f6861] transition-colors hover:border-[#d8d0c4] hover:text-[#1b1815]"
        >
          <svg class="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M16 17l5-5-5-5M21 12H9M9 21H6a2 2 0 01-2-2V5a2 2 0 012-2h3" /></svg>
        </a>
      </div>
    </header>

    <main class="mx-auto max-w-6xl px-6 py-10">
      <div class="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight text-[#111111]">Seus links</h1>
          <p class="mt-1.5 text-sm text-[#6f6861]">
            Cada link mostra o board de um projeto do Linear para quem está de fora.
          </p>
        </div>
        <button
          class="inline-flex items-center gap-2 rounded-lg bg-[#5e6ad2] px-5 py-3 text-sm font-medium text-white transition-[background-color,transform] duration-150 hover:-translate-y-px hover:bg-[#828fff]"
          @click="openModal"
        >
          <svg class="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" d="M12 5v14M5 12h14" /></svg>
          Novo link
        </button>
      </div>

      <!-- stats -->
      <div v-if="!pending && data?.links.length" class="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div class="flex items-center gap-4 rounded-2xl border border-[#e5dfd5] bg-white px-5 py-4">
          <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#5e6ad2]/10 text-[#5e6ad2]">
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H18a4 4 0 010 8h-4.5M10.5 6H6a4 4 0 000 8h4.5M8 10h8" /></svg>
          </span>
          <div>
            <div class="text-3xl font-semibold leading-none tabular-nums text-[#111111]">{{ stats.active }}</div>
            <div class="mt-1.5 text-xs text-[#6f6861]">Links ativos</div>
          </div>
        </div>
        <div class="flex items-center gap-4 rounded-2xl border border-[#e5dfd5] bg-white px-5 py-4">
          <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f1eee8] text-[#3a352f]">
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path stroke-linecap="round" stroke-linejoin="round" d="M12 2l9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 17l9 5 9-5" /></svg>
          </span>
          <div>
            <div class="text-3xl font-semibold leading-none tabular-nums text-[#111111]">{{ stats.total }}</div>
            <div class="mt-1.5 text-xs text-[#6f6861]">Total criados</div>
          </div>
        </div>
      </div>

      <!-- loading -->
      <div v-if="pending" class="mt-10 text-center text-sm text-[#a99f90]">Carregando...</div>

      <!-- empty -->
      <div
        v-else-if="!data?.links.length"
        class="mt-8 rounded-2xl border border-dashed border-[#e5dfd5] px-6 py-20 text-center"
      >
        <span class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#e5dfd5] bg-[#f1eee8] text-[#5e6ad2]">
          <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H18a4 4 0 010 8h-4.5M10.5 6H6a4 4 0 000 8h4.5M8 10h8" /></svg>
        </span>
        <p class="mt-5 text-base text-[#1b1815]">Você ainda não criou nenhum link.</p>
        <p class="mx-auto mt-1.5 max-w-sm text-sm text-[#6f6861]">
          Crie o primeiro link, escolha um projeto e compartilhe o board com seu cliente em segundos.
        </p>
        <button
          class="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#5e6ad2] px-5 py-2.5 text-sm font-medium text-white transition-[background-color,transform] duration-150 hover:-translate-y-px hover:bg-[#828fff]"
          @click="openModal"
        >
          <svg class="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" d="M12 5v14M5 12h14" /></svg>
          Criar primeiro link
        </button>
      </div>

      <!-- list -->
      <ul v-else class="mt-8 space-y-3.5">
        <li
          v-for="link in data.links"
          :key="link.id"
          class="rounded-2xl border border-[#e5dfd5] bg-white p-5 transition-colors duration-200 hover:border-[#d8d0c4]"
          :class="{ 'opacity-55': !link.active }"
        >
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div class="flex min-w-0 gap-4">
              <!-- project avatar -->
              <span
                class="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-[#1b1815]"
                :class="link.active ? 'border-[#5e6ad2]/30 bg-[#5e6ad2]/10 text-[#5e6ad2]' : 'border-[#e5dfd5] bg-[#f1eee8] text-[#6f6861]'"
              >
                <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path stroke-linecap="round" stroke-linejoin="round" d="M4 5h6v14H4zM14 5h6v8h-6z" /></svg>
              </span>

              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span class="truncate text-base font-medium text-[#1b1815]">{{ link.label || link.projectName || 'Projeto' }}</span>
                  <span v-if="!link.active" class="rounded bg-[#f1eee8] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[#6f6861]">Inativo</span>
                </div>
                <button
                  class="group mt-1 flex max-w-full items-center gap-1.5 text-sm text-[#6f6861] transition-colors hover:text-[#3a352f]"
                  :title="'Copiar link'"
                  @click="copyUrl(link)"
                >
                  <span class="truncate">{{ link.url }}</span>
                  <svg v-if="copiedId !== link.id" class="h-3.5 w-3.5 shrink-0 opacity-60 group-hover:opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 012-2h10" /></svg>
                  <span v-else class="flex shrink-0 items-center gap-1 text-xs font-medium text-[#5e6ad2]"><svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>copiado</span>
                </button>
                <div class="mt-2.5 flex flex-wrap items-center gap-2 text-[11px]">
                  <span class="flex items-center gap-1 rounded-full border border-[#e5dfd5] px-2 py-0.5 text-[#6f6861]">
                    <svg v-if="link.isPublic" class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9" /><path stroke-linecap="round" stroke-linejoin="round" d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" /></svg>
                    <svg v-else class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="11" width="14" height="9" rx="2" /><path stroke-linecap="round" d="M8 11V8a4 4 0 018 0v3" /></svg>
                    {{ link.isPublic ? 'Público' : 'Com senha' }}
                  </span>
                  <span
                    class="flex items-center gap-1 rounded-full border px-2 py-0.5"
                    :class="link.triageEnabled ? 'border-[#5e6ad2]/30 text-[#5e6ad2]' : 'border-[#e5dfd5] text-[#6f6861]'"
                  >
                    <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M3 6h18M7 12h10M11 18h2" /></svg>
                    Triagem {{ link.triageEnabled ? 'on' : 'off' }}
                  </span>
                  <span class="flex items-center gap-1 rounded-full border border-[#e5dfd5] px-2 py-0.5 text-[#6f6861]" :title="link.lastViewedAt ? 'Última: ' + new Date(link.lastViewedAt).toLocaleString('pt-BR') : 'Ainda não aberto'">
                    <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></svg>
                    <span class="tabular-nums">{{ link.viewCount }}</span>
                  </span>
                </div>
              </div>
            </div>

            <div class="flex shrink-0 items-center gap-2">
              <a
                :href="link.url"
                target="_blank"
                rel="noopener"
                class="inline-flex items-center gap-1.5 rounded-lg border border-[#e5dfd5] px-3 py-2 text-xs font-medium text-[#3a352f] transition-colors hover:border-[#d8d0c4] hover:text-[#1b1815]"
              >
                <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M14 5h5v5M19 5l-9 9M10 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-4" /></svg>
                Abrir
              </a>
              <button
                :disabled="rowBusy === link.id"
                class="inline-flex items-center gap-1.5 rounded-lg border border-[#e5dfd5] px-3 py-2 text-xs font-medium text-[#6f6861] transition-colors hover:border-[#d8d0c4] hover:text-[#1b1815] disabled:opacity-50"
                @click="toggleActive(link)"
              >
                <svg v-if="link.active" class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M18.36 6.64A9 9 0 1112 3v9" /></svg>
                <svg v-else class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M8 5v14l11-7z" /></svg>
                {{ link.active ? 'Desativar' : 'Reativar' }}
              </button>
              <button
                :disabled="rowBusy === link.id"
                aria-label="Excluir link"
                title="Excluir para sempre"
                class="flex h-9 w-9 items-center justify-center rounded-lg border border-[#e5dfd5] text-[#6f6861] transition-colors hover:border-red-300 hover:text-red-600 disabled:opacity-50"
                @click="deleteLink(link)"
              >
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m-7 0v12a1 1 0 001 1h6a1 1 0 001-1V7" /></svg>
              </button>
            </div>
          </div>
        </li>
      </ul>

    </main>

    <!-- new link modal -->
    <div
      v-if="showModal"
      class="fixed inset-0 z-50 flex items-center justify-center bg-[#1b1815]/45 px-4 backdrop-blur-sm"
      @click.self="closeModal"
    >
      <div class="w-full max-w-md rounded-xl border border-[#e5dfd5] bg-[#fbfaf7]">
        <div class="flex items-center justify-between border-b border-[#e5dfd5] px-5 py-4">
          <h2 class="text-sm font-semibold text-[#1b1815]">Novo link</h2>
          <button class="text-[#6f6861] transition-colors hover:text-[#3a352f]" @click="closeModal">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <form class="space-y-4 p-5" @submit.prevent="createLink">
          <div class="space-y-1.5">
            <label class="text-xs text-[#6f6861]">Projeto</label>
            <div v-if="projectsLoading" class="text-sm text-[#a99f90]">Carregando projetos...</div>
            <p v-else-if="projectsError" class="text-sm text-red-600">{{ projectsError }}</p>
            <select
              v-else
              v-model="form.projectId"
              class="w-full rounded-lg border border-[#e5dfd5] bg-white px-3 py-2 text-sm text-[#1b1815] outline-none transition-colors focus:border-[#5e6ad2]/60 focus:ring-1 focus:ring-[#5e6ad2]/30"
            >
              <option value="" disabled>Selecione um projeto</option>
              <option v-for="p in projects" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </div>

          <div class="space-y-1.5">
            <label class="text-xs text-[#6f6861]">Nome do link <span class="text-[#a99f90]">(opcional)</span></label>
            <input
              v-model="form.label"
              type="text"
              maxlength="120"
              placeholder="Ex: Acompanhamento Cliente X"
              class="w-full rounded-lg border border-[#e5dfd5] bg-white px-3 py-2 text-sm text-[#1b1815] placeholder-[#a99f90] outline-none transition-colors focus:border-[#5e6ad2]/60 focus:ring-1 focus:ring-[#5e6ad2]/30"
            />
          </div>

          <div class="space-y-1.5" :class="{ 'opacity-40': form.isPublic }">
            <label class="text-xs text-[#6f6861]">Senha</label>
            <input
              v-model="form.password"
              type="text"
              maxlength="200"
              :disabled="form.isPublic"
              placeholder="Defina uma senha de acesso"
              class="w-full rounded-lg border border-[#e5dfd5] bg-white px-3 py-2 text-sm text-[#1b1815] placeholder-[#a99f90] outline-none transition-colors focus:border-[#5e6ad2]/60 focus:ring-1 focus:ring-[#5e6ad2]/30"
            />
          </div>

          <label class="flex items-center gap-2 text-sm text-[#6f6861]">
            <input v-model="form.isPublic" type="checkbox" class="accent-[#5e6ad2]" />
            Tornar público (sem senha)
          </label>
          <label v-if="form.isPublic" class="flex items-center gap-2 pl-6 text-sm text-[#6f6861]">
            <input v-model="form.allowPublicTriage" type="checkbox" class="accent-[#5e6ad2]" />
            Permitir solicitações de triagem mesmo sem senha
          </label>

          <!-- advanced: client-facing visibility + branding -->
          <button type="button" class="flex w-full items-center gap-1.5 pt-1 text-xs font-medium text-[#5e6ad2] transition-colors hover:text-[#424aa2]" @click="showAdvanced = !showAdvanced">
            <svg class="h-3.5 w-3.5 transition-transform" :class="{ 'rotate-90': showAdvanced }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 6l6 6-6 6" /></svg>
            O que o cliente vê (opcional)
          </button>
          <div v-if="showAdvanced" class="space-y-3 rounded-lg border border-[#e5dfd5] bg-white p-3">
            <div class="space-y-1.5">
              <label class="text-xs text-[#6f6861]">Esconder issues com estas labels <span class="text-[#a99f90]">(separe por vírgula)</span></label>
              <input v-model="form.hiddenLabels" type="text" placeholder="interno, wip, bug-secreto"
                class="w-full rounded-lg border border-[#e5dfd5] bg-[#fbfaf7] px-3 py-2 text-sm text-[#1b1815] placeholder-[#a99f90] outline-none transition-colors focus:border-[#5e6ad2]/60 focus:ring-1 focus:ring-[#5e6ad2]/30" />
            </div>
            <div class="grid grid-cols-2 gap-2 text-sm text-[#6f6861]">
              <label class="flex items-center gap-2"><input v-model="form.hideEstimate" type="checkbox" class="accent-[#5e6ad2]" />Esconder estimativa</label>
              <label class="flex items-center gap-2"><input v-model="form.hideAssignee" type="checkbox" class="accent-[#5e6ad2]" />Esconder responsável</label>
              <label class="flex items-center gap-2"><input v-model="form.hideDueDate" type="checkbox" class="accent-[#5e6ad2]" />Esconder prazo</label>
              <label class="flex items-center gap-2"><input v-model="form.hidePriority" type="checkbox" class="accent-[#5e6ad2]" />Esconder prioridade</label>
            </div>
            <div class="space-y-1.5">
              <div class="flex items-center gap-2">
                <span class="text-xs font-medium text-[#6f6861]">Marca do cliente (white-label)</span>
              </div>
              <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input v-model="form.clientName" type="text" maxlength="80" placeholder="Nome do cliente (ex.: Acme Ltda)"
                  class="w-full rounded-lg border border-[#e5dfd5] bg-[#fbfaf7] px-3 py-2 text-sm text-[#1b1815] placeholder-[#a99f90] outline-none transition-colors focus:border-[#5e6ad2]/60 focus:ring-1 focus:ring-[#5e6ad2]/30" />
                <input v-model="form.clientLogoUrl" type="url" placeholder="Logo do cliente (URL)"
                  class="w-full rounded-lg border border-[#e5dfd5] bg-[#fbfaf7] px-3 py-2 text-sm text-[#1b1815] placeholder-[#a99f90] outline-none transition-colors focus:border-[#5e6ad2]/60 focus:ring-1 focus:ring-[#5e6ad2]/30" />
              </div>
            </div>
          </div>

          <p v-if="createError" class="text-xs text-red-600">{{ createError }}</p>

          <button
            type="submit"
            :disabled="!canSubmit"
            class="w-full rounded-lg bg-[#5e6ad2] py-2.5 text-sm font-medium text-white transition-[background-color,transform] duration-150 hover:-translate-y-px hover:bg-[#828fff] disabled:cursor-not-allowed disabled:opacity-40"
          >{{ creating ? 'Criando...' : 'Criar link' }}</button>
        </form>
      </div>
    </div>
  </div>
</template>
