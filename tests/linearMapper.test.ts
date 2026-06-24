import { describe, it, expect } from 'vitest'
import {
  mapToPublicIssue,
  groupByStatus,
  normalizeStateType,
  priorityLabel,
  computeProjectMeta,
  buildTriagePayload,
  triagePriorityToLinear,
  type RawIssueData,
  type PublicIssue,
} from '../server/utils/linearMapper'

const baseRaw: RawIssueData = {
  identifier: 'PRJ-1',
  title: 'Test issue',
  description: 'A description',
  stateName: 'In Progress',
  stateColor: '#f97316',
  stateType: 'started',
  priority: 2,
  estimate: 3,
  dueDate: '2026-03-15',
  updatedAt: '2026-03-10T12:00:00.000Z',
  milestone: 'Beta',
  assigneeName: 'João Silva',
  assigneeAvatarUrl: 'https://example.com/avatar.png',
  labels: [{ name: 'bug', color: '#ef4444' }],
}

describe('normalizeStateType', () => {
  it('passes through known Linear state types', () => {
    for (const t of ['backlog', 'unstarted', 'started', 'completed', 'canceled']) {
      expect(normalizeStateType(t)).toBe(t)
    }
  })
  it('falls back to unstarted for unknown/empty input', () => {
    expect(normalizeStateType('triage')).toBe('unstarted')
    expect(normalizeStateType(null)).toBe('unstarted')
    expect(normalizeStateType(undefined)).toBe('unstarted')
  })
})

describe('priorityLabel', () => {
  it('maps each priority level to its label', () => {
    expect(priorityLabel(0)).toBe('No priority')
    expect(priorityLabel(1)).toBe('Urgent')
    expect(priorityLabel(2)).toBe('High')
    expect(priorityLabel(3)).toBe('Medium')
    expect(priorityLabel(4)).toBe('Low')
  })
  it('falls back to No priority for out-of-range values', () => {
    expect(priorityLabel(9)).toBe('No priority')
  })
})

describe('mapToPublicIssue', () => {
  it('maps all fields including statusType and labels', () => {
    expect(mapToPublicIssue(baseRaw)).toEqual({
      identifier: 'PRJ-1',
      title: 'Test issue',
      description: 'A description',
      status: 'In Progress',
      statusColor: '#f97316',
      statusType: 'started',
      priority: 2,
      estimate: 3,
      dueDate: '2026-03-15',
      updatedAt: '2026-03-10T12:00:00.000Z',
      milestone: 'Beta',
      assignee: { name: 'João Silva', avatarUrl: 'https://example.com/avatar.png' },
      labels: [{ name: 'bug', color: '#ef4444' }],
    })
  })

  it('exposes only the allowed fields — no data leakage', () => {
    expect(Object.keys(mapToPublicIssue(baseRaw)).sort()).toEqual(
      ['assignee', 'description', 'dueDate', 'estimate', 'identifier', 'labels', 'milestone', 'priority', 'status', 'statusColor', 'statusType', 'title', 'updatedAt']
    )
  })

  it('sets assignee to null when assigneeName is null', () => {
    expect(mapToPublicIssue({ ...baseRaw, assigneeName: null, assigneeAvatarUrl: null }).assignee).toBeNull()
  })

  it('sets dueDate to null when missing', () => {
    expect(mapToPublicIssue({ ...baseRaw, dueDate: null }).dueDate).toBeNull()
  })

  it('clamps out-of-range priority to 0', () => {
    expect(mapToPublicIssue({ ...baseRaw, priority: 9 }).priority).toBe(0)
  })
})

describe('groupByStatus', () => {
  const makeIssue = (identifier: string, status: string, statusType: PublicIssue['statusType'], color = '#fff'): PublicIssue => ({
    identifier, title: 'T', description: null, status, statusColor: color, statusType, priority: 0,
    estimate: null, dueDate: null, updatedAt: null, milestone: null, assignee: null, labels: [],
  })

  it('groups issues into the correct columns', () => {
    const columns = groupByStatus([
      makeIssue('A-1', 'Todo', 'unstarted'),
      makeIssue('A-2', 'Todo', 'unstarted'),
      makeIssue('A-3', 'Done', 'completed', '#0f0'),
    ])
    expect(columns).toHaveLength(2)
    expect(columns.find(c => c.status === 'Todo')!.issues).toHaveLength(2)
    expect(columns.find(c => c.status === 'Done')!.issues).toHaveLength(1)
  })

  it('orders columns by Linear workflow rank regardless of input order', () => {
    const columns = groupByStatus([
      makeIssue('A-1', 'Done', 'completed'),
      makeIssue('A-2', 'In Progress', 'started'),
      makeIssue('A-3', 'Backlog', 'backlog'),
    ])
    expect(columns.map(c => c.type)).toEqual(['backlog', 'started', 'completed'])
  })

  it('returns empty array for empty input', () => {
    expect(groupByStatus([])).toEqual([])
  })
})

describe('computeProjectMeta', () => {
  const make = (statusType: PublicIssue['statusType']): PublicIssue => ({
    identifier: 'X', title: 'T', description: null, status: statusType, statusColor: '#fff', statusType, priority: 0,
    estimate: null, dueDate: null, updatedAt: null, milestone: null, assignee: null, labels: [],
  })

  it('computes progress and counts by type', () => {
    const meta = computeProjectMeta('Proj', '2026-12-01', [
      make('completed'), make('completed'), make('started'), make('backlog'),
    ])
    expect(meta.total).toBe(4)
    expect(meta.completed).toBe(2)
    expect(meta.progress).toBe(0.5)
    expect(meta.countsByType.completed).toBe(2)
    expect(meta.countsByType.started).toBe(1)
    expect(meta.countsByType.backlog).toBe(1)
    expect(meta.targetDate).toBe('2026-12-01')
  })

  it('returns progress 0 for an empty project', () => {
    const meta = computeProjectMeta('Empty', null, [])
    expect(meta.total).toBe(0)
    expect(meta.progress).toBe(0)
  })
})

describe('buildTriagePayload', () => {
  it('appends attribution to a provided description', () => {
    const { title, description } = buildTriagePayload({
      requesterName: '  Maria  ', title: '  Erro no login  ', description: 'Não consigo entrar',
    })
    expect(title).toBe('Erro no login')
    expect(description).toContain('Não consigo entrar')
    expect(description).toContain('**Maria**')
  })

  it('uses only attribution when no description is given', () => {
    const { description } = buildTriagePayload({ requesterName: 'Ana', title: 'X' })
    expect(description).toContain('**Ana**')
    expect(description).not.toContain('---\n_Solicitado por **Ana**\n')
  })

  it('prefixes the title with the request type', () => {
    const { title } = buildTriagePayload({ requesterName: 'Ana', title: 'Erro no login', type: 'Bug' })
    expect(title).toBe('[Bug] Erro no login')
  })

  it('omits the prefix when no type is given', () => {
    const { title } = buildTriagePayload({ requesterName: 'Ana', title: 'Sem tipo' })
    expect(title).toBe('Sem tipo')
  })

  it('records type, priority and requester email in the description', () => {
    const { description } = buildTriagePayload({
      requesterName: 'Ana', requesterEmail: 'ana@empresa.com', title: 'X',
      type: 'Melhoria', priorityLabel: 'Alta',
    })
    expect(description).toContain('Melhoria')
    expect(description).toContain('Alta')
    expect(description).toContain('ana@empresa.com')
  })
})

describe('triagePriorityToLinear', () => {
  it.each([
    ['Urgente', 1],
    ['Alta', 2],
    ['Média', 3],
    ['Baixa', 4],
  ] as const)('maps %s to Linear priority %i', (label, n) => {
    expect(triagePriorityToLinear(label)).toBe(n)
  })

  it('falls back to 0 (no priority) for unknown/empty', () => {
    expect(triagePriorityToLinear('')).toBe(0)
    expect(triagePriorityToLinear('qualquer')).toBe(0)
  })
})
