import { describe, it, expect } from 'vitest'
import { applyVisibility, type VisibilityConfig } from '../server/utils/visibility'
import type { KanbanColumn, PublicIssue } from '../server/utils/linearMapper'

const issue = (over: Partial<PublicIssue>): PublicIssue => ({
  identifier: 'PRJ-1', title: 'T', description: null, status: 'Todo', statusColor: '#fff',
  statusType: 'unstarted', priority: 2, estimate: 3, dueDate: '2026-06-01', updatedAt: null, milestone: null,
  assignee: { name: 'Ana', avatarUrl: null }, labels: [], ...over,
})
const col = (status: string, issues: PublicIssue[], over: Partial<KanbanColumn> = {}): KanbanColumn =>
  ({ status, color: '#fff', type: 'unstarted', issues, ...over })

const base: VisibilityConfig = {
  hiddenLabels: [], hiddenStatuses: [], hideEstimate: false, hideAssignee: false,
  hideDueDate: false, hidePriority: false,
}

describe('applyVisibility', () => {
  it('drops columns whose status is hidden', () => {
    const cols = [col('Backlog', [issue({})]), col('Doing', [issue({})])]
    const out = applyVisibility(cols, { ...base, hiddenStatuses: ['Backlog'] })
    expect(out.map((c) => c.status)).toEqual(['Doing'])
  })

  it('removes issues that carry a hidden label', () => {
    const cols = [col('Doing', [
      issue({ identifier: 'keep', labels: [{ name: 'public', color: '#0f0' }] }),
      issue({ identifier: 'drop', labels: [{ name: 'internal', color: '#f00' }] }),
    ])]
    const out = applyVisibility(cols, { ...base, hiddenLabels: ['internal'] })
    expect(out[0].issues.map((i) => i.identifier)).toEqual(['keep'])
  })

  it('strips hidden fields from issues (server-side, never sent to client)', () => {
    const cols = [col('Doing', [issue({})])]
    const out = applyVisibility(cols, {
      ...base, hideEstimate: true, hideAssignee: true, hideDueDate: true, hidePriority: true,
    })
    const i = out[0].issues[0]
    expect(i.estimate).toBeNull()
    expect(i.assignee).toBeNull()
    expect(i.dueDate).toBeNull()
    expect(i.priority).toBe(0)
  })

  it('keeps fields when not hidden', () => {
    const out = applyVisibility([col('Doing', [issue({})])], base)
    const i = out[0].issues[0]
    expect(i.estimate).toBe(3)
    expect(i.assignee?.name).toBe('Ana')
    expect(i.priority).toBe(2)
  })

  it('does not mutate the input', () => {
    const cols = [col('Doing', [issue({ estimate: 5 })])]
    applyVisibility(cols, { ...base, hideEstimate: true })
    expect(cols[0].issues[0].estimate).toBe(5)
  })

  it('handles an empty/permissive config as a no-op', () => {
    const cols = [col('Doing', [issue({}), issue({})])]
    expect(applyVisibility(cols, base)[0].issues).toHaveLength(2)
  })
})
