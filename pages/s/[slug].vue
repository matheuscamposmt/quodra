<script setup lang="ts">
import type { KanbanColumn, ProjectMeta, PublicIssue } from '~/server/utils/linearMapper'
import { sortIssues, filterIssues, type SortKey } from '~/server/utils/boardView'
import { renderMarkdown } from '~/server/utils/markdown'

const route = useRoute()
const slug = route.params.slug as string

type ProjectUpdate = { body: string; health: string | null; createdAt: string; author: string | null }
type Milestone = { name: string; targetDate: string | null }
type Board = {
  projectName: string
  project: ProjectMeta
  columns: KanbanColumn[]
  triageEnabled: boolean
  branding: { clientName: string | null; clientLogoUrl: string | null; showPoweredBy: boolean }
  state: string | null
  update: ProjectUpdate | null
  milestones: Milestone[]
}
type ShareResponse = { requiresPassword: true; projectName: string } | Board

// Health badge mapping (Linear: onTrack | atRisk | offTrack).
const HEALTH = {
  onTrack: { label: 'No prazo', cls: 'bg-[#e7f0e8] text-[#2f7d4a]' },
  atRisk: { label: 'Em risco', cls: 'bg-[#fbf0d9] text-[#9a6700]' },
  offTrack: { label: 'Atrasado', cls: 'bg-[#fbe3e3] text-[#b42318]' },
} as const
function health(h: string | null) {
  return (h && (HEALTH as Record<string, { label: string; cls: string }>)[h]) || null
}

const { data, error } = await useFetch<ShareResponse>(`/api/share/${slug}`)

const password = ref('')
const authError = ref('')
const submitting = ref(false)
const showTriage = ref(false)
const selected = ref<PublicIssue | null>(null)

// Board controls
const search = ref('')
const sortKey = ref<SortKey>('')
const filterAssignee = ref('')
const filterLabel = ref('')
const filterMilestone = ref('')
const showUpdate = ref(false) // project update opens in a dialog

// Hide columns (e.g. "Duplicate"), persisted per-link in the viewer's browser.
const hiddenCols = ref<string[]>([])
const colsKey = `quodra:hiddencols:${slug}`
function toggleCol(status: string) {
  const set = new Set(hiddenCols.value)
  set.has(status) ? set.delete(status) : set.add(status)
  hiddenCols.value = [...set]
  try { localStorage.setItem(colsKey, JSON.stringify(hiddenCols.value)) } catch { /* storage blocked */ }
}

const requiresPassword = computed(
  () => data.value && 'requiresPassword' in data.value && data.value.requiresPassword
)
const board = computed<Board | null>(() =>
  data.value && 'columns' in data.value ? data.value : null
)

// Defined after `board` so the reactive getter never hits a temporal-dead-zone.
useHead(() => ({
  title: board.value ? `${board.value.projectName} · Quodra` : 'Quodra',
  meta: [{ name: 'robots', content: 'noindex, nofollow' }],
}))

const allIssues = computed<PublicIssue[]>(() => board.value?.columns.flatMap((c) => c.issues) ?? [])
const assignees = computed(() =>
  [...new Set(allIssues.value.map((i) => i.assignee?.name).filter(Boolean) as string[])].sort()
)
const labelNames = computed(() =>
  [...new Set(allIssues.value.flatMap((i) => i.labels.map((l) => l.name)))].sort()
)
const milestoneNames = computed(() =>
  [...new Set(allIssues.value.map((i) => i.milestone).filter(Boolean) as string[])].sort()
)

// Apply filters + sort per column (pure helpers, unit-tested).
const viewColumns = computed<KanbanColumn[]>(() => {
  if (!board.value) return []
  const f = {
    query: search.value || undefined,
    assignee: filterAssignee.value || undefined,
    label: filterLabel.value || undefined,
    milestone: filterMilestone.value || undefined,
  }
  return board.value.columns
    .filter((col) => !hiddenCols.value.includes(col.status))
    .map((col) => ({
      ...col,
      issues: sortIssues(filterIssues(col.issues, f), sortKey.value),
    }))
})
const allStatuses = computed(() => board.value?.columns.map((c) => c.status) ?? [])
const hasFilters = computed(() => !!(search.value || filterAssignee.value || filterLabel.value || filterMilestone.value))
const matchCount = computed(() => viewColumns.value.reduce((n, c) => n + c.issues.length, 0))

async function unlock() {
  submitting.value = true
  authError.value = ''
  try {
    data.value = await $fetch<ShareResponse>(`/api/share/${slug}`, {
      method: 'POST',
      body: { password: password.value },
    })
  } catch (e: unknown) {
    authError.value = (e as { data?: { message?: string } })?.data?.message ?? 'Senha incorreta'
  } finally {
    submitting.value = false
  }
}

// Drives the one-time progress-bar fill animation (0 → real % on first paint).
const boardReady = ref(false)
let refreshTimer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  try { hiddenCols.value = JSON.parse(localStorage.getItem(colsKey) || '[]') } catch { /* ignore */ }
  requestAnimationFrame(() => (boardReady.value = true))
  refreshTimer = setInterval(async () => {
    if (!board.value) return
    try {
      // ?refresh=1 → the silent hourly refresh isn't counted as a view.
      const fresh = await $fetch<ShareResponse>(`/api/share/${slug}?refresh=1`)
      if (fresh && 'columns' in fresh) data.value = fresh
    } catch {
      /* keep last good board */
    }
  }, 60 * 60 * 1000)
})
onBeforeUnmount(() => clearInterval(refreshTimer))

const PRIORITY_PT = ['Sem prioridade', 'Urgente', 'Alta', 'Média', 'Baixa']
function priorityPt(p: number): string { return PRIORITY_PT[p] ?? PRIORITY_PT[0] }

function isOverdue(dueDate: string | null): boolean {
  return !!dueDate && new Date(dueDate) < new Date()
}
function formatDate(d: string | null): string {
  if (!d) return ''
  const parsed = new Date(d)
  if (Number.isNaN(parsed.getTime())) return d
  return parsed.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}
function timeAgo(d: string | null): string {
  if (!d) return ''
  const diff = Date.now() - new Date(d).getTime()
  if (Number.isNaN(diff)) return ''
  const days = Math.floor(diff / 86400000)
  if (days <= 0) return 'hoje'
  if (days === 1) return 'ontem'
  if (days < 30) return `há ${days} dias`
  const months = Math.floor(days / 30)
  return months === 1 ? 'há 1 mês' : `há ${months} meses`
}
function initials(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean).map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}

const progressPct = computed(() => Math.round((board.value?.project.progress ?? 0) * 100))
</script>

<template>
  <div class="min-h-screen bg-[#eeebe4] font-sans text-[#1b1815]">

    <div v-if="error" class="flex min-h-screen items-center justify-center">
      <p class="text-sm text-[#8a8175]">Erro ao carregar. Verifique o link.</p>
    </div>

    <!-- password gate -->
    <div v-else-if="requiresPassword" class="flex min-h-screen items-center justify-center px-4">
      <div class="w-full max-w-sm space-y-6 rounded-xl border border-[#e7e1d7] bg-white p-8">
        <div class="flex flex-col items-center gap-3 text-center">
          <svg class="h-8 w-8 text-[#6b6258]" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
          <div>
            <p class="mb-1 text-xs uppercase tracking-widest text-[#8a8175]">Acesso protegido</p>
            <h1 class="text-base font-medium text-[#1b1815]">{{ (data as { projectName: string })?.projectName || 'Projeto' }}</h1>
          </div>
        </div>
        <form class="space-y-3" @submit.prevent="unlock">
          <input v-model="password" type="password" placeholder="Senha" autocomplete="current-password"
            class="w-full rounded-lg border border-[#e7e1d7] bg-black/[0.04] px-3 py-2.5 text-sm text-[#1b1815] placeholder-[#a99f90] outline-none transition-colors focus:border-[#5e6ad2]/60 focus:ring-1 focus:ring-[#5e6ad2]/40" />
          <p v-if="authError" class="text-xs text-red-400">{{ authError }}</p>
          <button type="submit" :disabled="submitting || !password"
            class="w-full rounded-lg bg-[#5e6ad2] py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#828fff] disabled:cursor-not-allowed disabled:opacity-40">
            {{ submitting ? 'Verificando...' : 'Acessar' }}
          </button>
        </form>
      </div>
    </div>

    <!-- board -->
    <div v-else-if="board" class="flex h-screen flex-col">
      <!-- navbar: brand + project + progress/counts/target inline + triage -->
      <div class="shrink-0 border-b border-[#e7e1d7] bg-white">
        <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-6 py-3">
          <div class="flex min-w-0 items-center gap-2.5">
            <img v-if="board.branding.clientLogoUrl" :src="board.branding.clientLogoUrl" :alt="board.branding.clientName || ''" class="h-7 w-7 shrink-0 rounded object-contain" />
            <span class="truncate font-semibold tracking-tight text-[#1b1815]">{{ board.branding.clientName || board.projectName }}</span>
            <span v-if="board.state" class="hidden shrink-0 rounded-full bg-black/[0.05] px-2 py-0.5 text-[11px] capitalize text-[#6b6258] sm:inline">{{ board.state }}</span>
          </div>
          <div class="flex items-center gap-2 text-xs text-[#6b6258]">
            <div class="h-1.5 w-24 overflow-hidden rounded-full bg-black/10">
              <div class="h-full rounded-full bg-[#5e6ad2] transition-[width] duration-700 ease-quodra motion-reduce:transition-none" :style="{ width: (boardReady ? progressPct : 0) + '%' }" />
            </div>
            <span class="tabular-nums text-[#3a352f]">{{ progressPct }}%</span>
            <span class="flex items-center gap-1 tabular-nums">
              <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              {{ board.project.completed }}/{{ board.project.total }}
            </span>
            <span v-if="board.project.targetDate" class="hidden items-center gap-1 sm:flex">
              <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4.5" width="18" height="16" rx="2" /><path stroke-linecap="round" d="M3 9h18M8 2.5v4M16 2.5v4" /></svg>
              {{ formatDate(board.project.targetDate) }}
            </span>
          </div>
          <button v-if="board.triageEnabled"
            class="ml-auto flex shrink-0 items-center gap-1.5 rounded-md bg-[#5e6ad2] px-3 py-2 text-xs font-medium text-white transition-[background-color,transform] duration-150 hover:-translate-y-px hover:bg-[#828fff]"
            @click="showTriage = true">
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path stroke-linecap="round" d="M12 5v14M5 12h14" /></svg>
            Nova solicitação
          </button>
        </div>
      </div>

      <!-- toolbar: update + columns (left) · filters (right), same row -->
      <div class="shrink-0 border-b border-[#e7e1d7] bg-[#f3f0ea]">
        <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-6 py-2.5">
          <div class="flex items-center gap-2">
            <button v-if="board.update" type="button"
              class="flex items-center gap-1.5 rounded-md border border-[#e7e1d7] bg-white px-2.5 py-1.5 text-xs text-[#3a352f] transition-colors hover:border-[#d8cfc0]"
              @click="showUpdate = true">
              <span v-if="health(board.update.health)" class="rounded px-1.5 py-0.5 text-[10px] font-medium" :class="health(board.update.health)!.cls">{{ health(board.update.health)!.label }}</span>
              Atualização
            </button>
            <details class="relative">
              <summary class="flex cursor-pointer list-none items-center gap-1.5 rounded-md border border-[#e7e1d7] bg-white px-2.5 py-1.5 text-xs text-[#3a352f] transition-colors hover:border-[#d8cfc0]">
                <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="5" height="16" rx="1" /><rect x="10" y="4" width="5" height="16" rx="1" /><rect x="17" y="4" width="4" height="16" rx="1" /></svg>
                Colunas<span v-if="hiddenCols.length" class="text-[#8a8175]"> ({{ allStatuses.length - hiddenCols.length }}/{{ allStatuses.length }})</span>
              </summary>
              <div class="absolute left-0 z-20 mt-1 w-52 rounded-lg border border-[#e7e1d7] bg-white p-1.5 shadow-lg">
                <label v-for="s in allStatuses" :key="s" class="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs text-[#3a352f] hover:bg-black/[0.03]">
                  <input type="checkbox" class="accent-[#5e6ad2]" :checked="!hiddenCols.includes(s)" @change="toggleCol(s)" />
                  {{ s }}
                </label>
              </div>
            </details>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <div class="relative">
              <svg class="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a8175]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7" /><path stroke-linecap="round" d="M21 21l-4-4" /></svg>
              <input v-model="search" type="text" placeholder="Buscar"
                class="w-40 rounded-md border border-[#e7e1d7] bg-white py-1.5 pl-8 pr-3 text-xs text-[#1b1815] placeholder-[#a99f90] outline-none transition-colors focus:border-[#5e6ad2]/60" />
            </div>
            <div class="relative">
              <svg class="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a8175]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7h13M3 12h9M3 17h5M18 8v9m0 0l-2.5-2.5M18 17l2.5-2.5" /></svg>
              <select v-model="sortKey" class="rounded-md border border-[#e7e1d7] bg-white py-1.5 pl-7 pr-2.5 text-xs text-[#3a352f] outline-none focus:border-[#5e6ad2]/60">
                <option value="">Ordenar</option>
                <option value="priority">Prioridade</option>
                <option value="dueDate">Prazo</option>
                <option value="updated">Atualização</option>
                <option value="title">Título</option>
              </select>
            </div>
            <div v-if="assignees.length" class="relative">
              <svg class="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a8175]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM4 21v-1a6 6 0 0112 0v1" /></svg>
              <select v-model="filterAssignee" class="rounded-md border border-[#e7e1d7] bg-white py-1.5 pl-7 pr-2.5 text-xs text-[#3a352f] outline-none focus:border-[#5e6ad2]/60">
                <option value="">Responsável</option>
                <option v-for="a in assignees" :key="a" :value="a">{{ a }}</option>
              </select>
            </div>
            <div v-if="labelNames.length" class="relative">
              <svg class="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a8175]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h5.6a2 2 0 011.4.6l7 7a2 2 0 010 2.8l-5.6 5.6a2 2 0 01-2.8 0l-7-7A2 2 0 013 10.6V5z" /><circle cx="7.5" cy="7.5" r="1" fill="currentColor" /></svg>
              <select v-model="filterLabel" class="rounded-md border border-[#e7e1d7] bg-white py-1.5 pl-7 pr-2.5 text-xs text-[#3a352f] outline-none focus:border-[#5e6ad2]/60">
                <option value="">Label</option>
                <option v-for="l in labelNames" :key="l" :value="l">{{ l }}</option>
              </select>
            </div>
            <div v-if="milestoneNames.length" class="relative">
              <svg class="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8a8175]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M5 21V4m0 0h12l-2.5 4L17 12H5" /></svg>
              <select v-model="filterMilestone" class="rounded-md border border-[#e7e1d7] bg-white py-1.5 pl-7 pr-2.5 text-xs text-[#3a352f] outline-none focus:border-[#5e6ad2]/60">
                <option value="">Marco</option>
                <option v-for="m in milestoneNames" :key="m" :value="m">{{ m }}</option>
              </select>
            </div>
            <button v-if="hasFilters" class="text-xs text-[#6b6258] transition-colors hover:text-[#1b1815]" @click="search = ''; filterAssignee = ''; filterLabel = ''; filterMilestone = ''">
              Limpar ({{ matchCount }})
            </button>
          </div>
        </div>
      </div>

      <!-- columns: fill the viewport; each column scrolls internally (no giant page scroll) -->
      <div class="flex-1 overflow-x-auto py-5">
        <div class="flex h-full gap-3 px-6 [justify-content:safe_center]">
          <div v-for="col in viewColumns" :key="col.status" class="flex w-72 shrink-0 flex-col rounded-lg border border-[#e7e1d7] bg-white">
            <div class="flex items-center gap-2 border-b border-[#e7e1d7] px-3 py-2.5">
              <StatusIcon :type="col.type" :color="col.color" />
              <span class="flex-1 truncate text-xs font-medium text-[#3a352f]">{{ col.status }}</span>
              <span class="text-xs tabular-nums text-[#8a8175]">{{ col.issues.length }}</span>
            </div>
            <div class="flex flex-col gap-1.5 overflow-y-auto p-2">
              <button v-for="issue in col.issues" :key="issue.identifier" type="button"
                class="space-y-2 rounded-md border border-[#e7e1d7] bg-[#f6f4ef] p-3 text-left transition-colors hover:border-[#d8cfc0]"
                @click="selected = issue">
                <div class="flex items-center gap-1.5">
                  <PriorityIcon :priority="issue.priority" />
                  <span class="text-[11px] text-[#8a8175]">{{ issue.identifier }}</span>
                  <span v-if="issue.estimate" class="ml-auto rounded bg-black/[0.04] px-1.5 text-[10px] tabular-nums text-[#6b6258]">{{ issue.estimate }} pt</span>
                </div>
                <p class="text-sm leading-snug text-[#1b1815]">{{ issue.title }}</p>
                <div v-if="issue.labels.length" class="flex flex-wrap items-center gap-1">
                  <span v-for="label in issue.labels" :key="label.name" class="flex items-center gap-1 rounded-full border border-[#e7e1d7] py-0.5 pl-1.5 pr-2 text-[10px] text-[#3a352f]">
                    <span class="h-1.5 w-1.5 rounded-full" :style="{ backgroundColor: label.color }" />{{ label.name }}
                  </span>
                </div>
                <div class="flex items-center gap-2">
                  <span v-if="issue.dueDate" class="text-[11px]" :class="isOverdue(issue.dueDate) ? 'text-red-400' : 'text-[#8a8175]'">{{ formatDate(issue.dueDate) }}</span>
                  <div v-if="issue.assignee" class="ml-auto flex items-center gap-1" :title="issue.assignee.name">
                    <img v-if="issue.assignee.avatarUrl" :src="issue.assignee.avatarUrl" :alt="issue.assignee.name" class="h-5 w-5 rounded-full" />
                    <span v-else class="flex h-5 w-5 items-center justify-center rounded-full bg-black/10 text-[9px] font-medium text-[#3a352f]">{{ initials(issue.assignee.name) }}</span>
                  </div>
                </div>
              </button>
              <p v-if="!col.issues.length" class="py-4 text-center text-xs text-[#a99f90]">{{ hasFilters ? 'Nenhum resultado' : 'Vazio' }}</p>
            </div>
          </div>
        </div>
      </div>
      <a
        v-if="board.branding.showPoweredBy"
        href="https://quodra.com.br/?utm_source=board&utm_medium=powered_by"
        target="_blank"
        rel="noopener"
        class="fixed bottom-3 right-3 z-30 flex items-center gap-1.5 rounded-full border border-[#e7e1d7] bg-white/95 px-3 py-1.5 text-[11px] font-medium text-[#6b6258] shadow-sm backdrop-blur transition-colors hover:border-[#d8cfc0] hover:text-[#1b1815]"
      >
        Feito com <span class="font-semibold text-[#5e6ad2]">Quodra</span>
      </a>
    </div>

    <!-- project update dialog -->
    <div v-if="showUpdate && board?.update" class="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4" @click.self="showUpdate = false">
      <div class="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[#e7e1d7] bg-[#f6f4ef] shadow-2xl">
        <div class="flex items-start justify-between gap-4 border-b border-[#e7e1d7] px-5 py-4">
          <div class="flex flex-wrap items-center gap-2">
            <span v-if="health(board.update.health)" class="rounded-full px-2 py-0.5 text-[11px] font-medium" :class="health(board.update.health)!.cls">{{ health(board.update.health)!.label }}</span>
            <span class="text-xs text-[#8a8175]">Atualização{{ board.update.author ? ' de ' + board.update.author : '' }} · {{ timeAgo(board.update.createdAt) }}</span>
          </div>
          <button class="text-[#6b6258] transition-colors hover:text-[#1b1815]" aria-label="Fechar" @click="showUpdate = false">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <div
          class="px-5 py-5 text-sm leading-relaxed text-[#3a352f] [&_a]:text-[#5e6ad2] [&_a]:underline [&_code]:rounded [&_code]:bg-black/[0.05] [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px] [&_h3]:font-semibold [&_h3]:text-[#1b1815] [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5"
          v-html="renderMarkdown(board.update.body)"
        />
      </div>
    </div>

    <!-- issue detail -->
    <div v-if="selected" class="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4" @click.self="selected = null">
      <div class="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-xl border border-[#e7e1d7] bg-[#f6f4ef] shadow-2xl">
        <div class="flex items-start justify-between gap-4 border-b border-[#e7e1d7] px-5 py-4">
          <div class="flex items-center gap-2">
            <PriorityIcon :priority="selected.priority" />
            <span class="text-xs text-[#8a8175]">{{ selected.identifier }}</span>
          </div>
          <button class="text-[#6b6258] transition-colors hover:text-[#1b1815]" aria-label="Fechar" @click="selected = null">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <div class="space-y-5 px-5 py-5">
          <h2 class="text-lg font-medium leading-snug text-[#1b1815]">{{ selected.title }}</h2>

          <div class="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div class="space-y-1">
              <div class="text-[11px] uppercase tracking-wide text-[#8a8175]">Status</div>
              <div class="flex items-center gap-1.5 text-[#1b1815]">
                <span class="h-2 w-2 rounded-full" :style="{ backgroundColor: selected.statusColor }" />{{ selected.status }}
              </div>
            </div>
            <div class="space-y-1">
              <div class="text-[11px] uppercase tracking-wide text-[#8a8175]">Prioridade</div>
              <div class="text-[#1b1815]">{{ priorityPt(selected.priority) }}</div>
            </div>
            <div class="space-y-1">
              <div class="text-[11px] uppercase tracking-wide text-[#8a8175]">Responsável</div>
              <div class="text-[#1b1815]">{{ selected.assignee?.name ?? '—' }}</div>
            </div>
            <div class="space-y-1">
              <div class="text-[11px] uppercase tracking-wide text-[#8a8175]">Prazo</div>
              <div :class="isOverdue(selected.dueDate) ? 'text-red-400' : 'text-[#1b1815]'">{{ selected.dueDate ? formatDate(selected.dueDate) : '—' }}</div>
            </div>
            <div v-if="selected.estimate" class="space-y-1">
              <div class="text-[11px] uppercase tracking-wide text-[#8a8175]">Estimativa</div>
              <div class="text-[#1b1815]">{{ selected.estimate }} pontos</div>
            </div>
            <div v-if="selected.updatedAt" class="space-y-1">
              <div class="text-[11px] uppercase tracking-wide text-[#8a8175]">Atualizada</div>
              <div class="text-[#1b1815]">{{ timeAgo(selected.updatedAt) }}</div>
            </div>
          </div>

          <div v-if="selected.labels.length" class="flex flex-wrap items-center gap-1.5">
            <span v-for="label in selected.labels" :key="label.name" class="flex items-center gap-1 rounded-full border border-[#e7e1d7] py-0.5 pl-2 pr-2.5 text-xs text-[#3a352f]">
              <span class="h-1.5 w-1.5 rounded-full" :style="{ backgroundColor: label.color }" />{{ label.name }}
            </span>
          </div>

          <div v-if="selected.description" class="space-y-1.5">
            <div class="text-[11px] uppercase tracking-wide text-[#8a8175]">Descrição</div>
            <div
              class="rounded-lg border border-[#e7e1d7] bg-white p-3 text-sm leading-relaxed text-[#3a352f] [&_a]:text-[#5e6ad2] [&_a]:underline [&_code]:rounded [&_code]:bg-black/[0.05] [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px] [&_h3]:font-semibold [&_h3]:text-[#1b1815] [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5"
              v-html="renderMarkdown(selected.description)"
            />
          </div>
          <p v-else class="text-sm text-[#8a8175]">Sem descrição.</p>
        </div>
      </div>
    </div>

    <TriageForm v-if="showTriage" :slug="slug" @close="showTriage = false" />
  </div>
</template>
