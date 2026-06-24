export type StateType = 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled'

export type Label = { name: string; color: string }

export type PublicIssue = {
  identifier: string
  title: string
  description: string | null
  status: string
  statusColor: string
  statusType: StateType
  priority: 0 | 1 | 2 | 3 | 4
  estimate: number | null
  dueDate: string | null
  updatedAt: string | null
  milestone: string | null
  assignee: { name: string; avatarUrl: string | null } | null
  labels: Label[]
}

export type KanbanColumn = {
  status: string
  color: string
  type: StateType
  issues: PublicIssue[]
}

export type ProjectMeta = {
  name: string
  progress: number
  total: number
  completed: number
  countsByType: Record<StateType, number>
  targetDate: string | null
}

export type RawIssueData = {
  identifier: string
  title: string
  description?: string | null
  stateName: string
  stateColor: string
  stateType: string
  priority: number
  estimate?: number | null
  dueDate: string | null
  updatedAt?: string | null
  milestone?: string | null
  assigneeName: string | null
  assigneeAvatarUrl: string | null
  labels: Label[]
}

const STATE_TYPES: StateType[] = ['backlog', 'unstarted', 'started', 'completed', 'canceled']
const TYPE_RANK: Record<StateType, number> = {
  backlog: 0,
  unstarted: 1,
  started: 2,
  completed: 3,
  canceled: 4,
}

const PRIORITY_LABELS = ['No priority', 'Urgent', 'High', 'Medium', 'Low'] as const

export function normalizeStateType(type: string | null | undefined): StateType {
  return STATE_TYPES.includes(type as StateType) ? (type as StateType) : 'unstarted'
}

export function priorityLabel(priority: number): string {
  return PRIORITY_LABELS[priority] ?? PRIORITY_LABELS[0]
}

export function mapToPublicIssue(raw: RawIssueData): PublicIssue {
  return {
    identifier: raw.identifier,
    title: raw.title,
    description: raw.description ?? null,
    status: raw.stateName,
    statusColor: raw.stateColor,
    statusType: normalizeStateType(raw.stateType),
    priority: (raw.priority >= 0 && raw.priority <= 4 ? raw.priority : 0) as 0 | 1 | 2 | 3 | 4,
    estimate: raw.estimate ?? null,
    dueDate: raw.dueDate ?? null,
    updatedAt: raw.updatedAt ?? null,
    milestone: raw.milestone ?? null,
    assignee: raw.assigneeName
      ? { name: raw.assigneeName, avatarUrl: raw.assigneeAvatarUrl ?? null }
      : null,
    labels: raw.labels ?? [],
  }
}

/**
 * Groups issues into columns keyed by status name, then orders the columns by
 * Linear's workflow rank (backlog → unstarted → started → completed → canceled).
 * Order within the same rank follows first-seen insertion (stable sort).
 */
export function groupByStatus(issues: PublicIssue[]): KanbanColumn[] {
  const map = new Map<string, KanbanColumn>()
  for (const issue of issues) {
    if (!map.has(issue.status)) {
      map.set(issue.status, {
        status: issue.status,
        color: issue.statusColor,
        type: issue.statusType,
        issues: [],
      })
    }
    map.get(issue.status)!.issues.push(issue)
  }
  return Array.from(map.values()).sort((a, b) => TYPE_RANK[a.type] - TYPE_RANK[b.type])
}

export function computeProjectMeta(
  name: string,
  targetDate: string | null,
  issues: PublicIssue[]
): ProjectMeta {
  const countsByType: Record<StateType, number> = {
    backlog: 0,
    unstarted: 0,
    started: 0,
    completed: 0,
    canceled: 0,
  }
  for (const issue of issues) countsByType[issue.statusType]++

  const total = issues.length
  const completed = countsByType.completed
  const progress = total > 0 ? completed / total : 0

  return { name, progress, total, completed, countsByType, targetDate }
}

/**
 * Builds the Linear issue title/description for a triage request submitted by an
 * external stakeholder. Attribution is appended to the description so the owner
 * always knows who opened the request.
 */
export function buildTriagePayload(input: {
  requesterName: string
  requesterEmail?: string
  title: string
  description?: string
  type?: string
  priorityLabel?: string
}): { title: string; description: string } {
  const cleanTitle = input.title.trim()
  // Type prefix makes the request scannable in the owner's Linear triage queue.
  const title = input.type ? `[${input.type}] ${cleanTitle}` : cleanTitle
  const body = (input.description ?? '').trim()

  const meta: string[] = []
  if (input.type) meta.push(`**Tipo:** ${input.type}`)
  if (input.priorityLabel) meta.push(`**Prioridade:** ${input.priorityLabel}`)
  const email = input.requesterEmail?.trim()
  const who = `**${input.requesterName.trim()}**` + (email ? ` (${email})` : '')
  meta.push(`_Solicitado por ${who} via link público de acompanhamento._`)

  const footer = meta.join('\n')
  const description = body ? `${body}\n\n---\n${footer}` : footer
  return { title, description }
}

// Maps the requester-facing priority label to Linear's numeric priority.
const TRIAGE_PRIORITY: Record<string, number> = { Urgente: 1, Alta: 2, Média: 3, Baixa: 4 }

export function triagePriorityToLinear(label: string): number {
  return TRIAGE_PRIORITY[label] ?? 0
}
