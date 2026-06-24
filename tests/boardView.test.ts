import { describe, it, expect } from 'vitest'
import { sortIssues, filterIssues, type SortKey } from '../server/utils/boardView'
import type { PublicIssue } from '../server/utils/linearMapper'

const issue = (over: Partial<PublicIssue>): PublicIssue => ({
  identifier: 'PRJ-1',
  title: 'Title',
  description: null,
  status: 'Todo',
  statusColor: '#fff',
  statusType: 'unstarted',
  priority: 0,
  estimate: null,
  dueDate: null,
  updatedAt: null,
  milestone: null,
  assignee: null,
  labels: [],
  ...over,
})

describe('sortIssues', () => {
  it('orders by priority with Urgent first and No-priority last', () => {
    const out = sortIssues(
      [issue({ identifier: 'none', priority: 0 }), issue({ identifier: 'low', priority: 4 }), issue({ identifier: 'urgent', priority: 1 }), issue({ identifier: 'high', priority: 2 })],
      'priority',
    )
    expect(out.map((i) => i.identifier)).toEqual(['urgent', 'high', 'low', 'none'])
  })

  it('orders by dueDate soonest first, nulls last', () => {
    const out = sortIssues(
      [issue({ identifier: 'none', dueDate: null }), issue({ identifier: 'late', dueDate: '2026-12-01' }), issue({ identifier: 'soon', dueDate: '2026-06-01' })],
      'dueDate',
    )
    expect(out.map((i) => i.identifier)).toEqual(['soon', 'late', 'none'])
  })

  it('orders by updated most-recent first', () => {
    const out = sortIssues(
      [issue({ identifier: 'old', updatedAt: '2026-01-01T00:00:00Z' }), issue({ identifier: 'new', updatedAt: '2026-06-01T00:00:00Z' })],
      'updated',
    )
    expect(out.map((i) => i.identifier)).toEqual(['new', 'old'])
  })

  it('orders by title alphabetically', () => {
    const out = sortIssues([issue({ identifier: 'b', title: 'Banana' }), issue({ identifier: 'a', title: 'Abacaxi' })], 'title')
    expect(out.map((i) => i.identifier)).toEqual(['a', 'b'])
  })

  it('does not mutate the input array', () => {
    const input = [issue({ identifier: 'a', priority: 4 }), issue({ identifier: 'b', priority: 1 })]
    sortIssues(input, 'priority')
    expect(input.map((i) => i.identifier)).toEqual(['a', 'b'])
  })

  it('returns input order for an unknown/none sort key', () => {
    const input = [issue({ identifier: 'a' }), issue({ identifier: 'b' })]
    expect(sortIssues(input, '' as SortKey).map((i) => i.identifier)).toEqual(['a', 'b'])
  })
})

describe('filterIssues', () => {
  const issues = [
    issue({ identifier: 'PRJ-1', title: 'Login quebrado', assignee: { name: 'Ana', avatarUrl: null }, labels: [{ name: 'bug', color: '#f00' }], priority: 1 }),
    issue({ identifier: 'PRJ-2', title: 'Nova tela', assignee: { name: 'Beto', avatarUrl: null }, labels: [{ name: 'feature', color: '#0f0' }], priority: 3 }),
  ]

  it('matches query against title (case-insensitive)', () => {
    expect(filterIssues(issues, { query: 'login' }).map((i) => i.identifier)).toEqual(['PRJ-1'])
  })

  it('matches query against identifier', () => {
    expect(filterIssues(issues, { query: 'prj-2' }).map((i) => i.identifier)).toEqual(['PRJ-2'])
  })

  it('filters by assignee name', () => {
    expect(filterIssues(issues, { assignee: 'Beto' }).map((i) => i.identifier)).toEqual(['PRJ-2'])
  })

  it('filters by label name', () => {
    expect(filterIssues(issues, { label: 'bug' }).map((i) => i.identifier)).toEqual(['PRJ-1'])
  })

  it('filters by priority', () => {
    expect(filterIssues(issues, { priority: 3 }).map((i) => i.identifier)).toEqual(['PRJ-2'])
  })

  it('filters by milestone', () => {
    const ms = [issue({ identifier: 'A', milestone: 'Beta' }), issue({ identifier: 'B', milestone: 'GA' })]
    expect(filterIssues(ms, { milestone: 'GA' }).map((i) => i.identifier)).toEqual(['B'])
  })

  it('combines filters (AND)', () => {
    expect(filterIssues(issues, { query: 'tela', assignee: 'Ana' })).toEqual([])
  })

  it('returns all issues when no filters are set', () => {
    expect(filterIssues(issues, {})).toHaveLength(2)
  })
})
