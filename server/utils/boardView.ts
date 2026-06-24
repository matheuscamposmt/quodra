import type { PublicIssue } from './linearMapper'

// Client-side board controls: sort issues within a column and filter them.
// Pure functions so they are trivially testable and reusable on server or client.

export type SortKey = 'priority' | 'dueDate' | 'updated' | 'title' | ''

// Linear priority: 0=None, 1=Urgent, 2=High, 3=Medium, 4=Low. For a "priority"
// sort we want Urgent first and None last, so remap None to the end.
const priorityRank = (p: number): number => (p === 0 ? 99 : p)

export function sortIssues(issues: PublicIssue[], key: SortKey): PublicIssue[] {
  const copy = [...issues]
  switch (key) {
    case 'priority':
      return copy.sort((a, b) => priorityRank(a.priority) - priorityRank(b.priority))
    case 'dueDate':
      return copy.sort((a, b) => nullableTime(a.dueDate) - nullableTime(b.dueDate))
    case 'updated':
      // Most recent first; missing timestamps sink to the bottom.
      return copy.sort((a, b) => nullableTime(b.updatedAt, -Infinity) - nullableTime(a.updatedAt, -Infinity))
    case 'title':
      return copy.sort((a, b) => a.title.localeCompare(b.title))
    default:
      return copy
  }
}

// Parses a date to epoch ms; absent/invalid dates sort to `fallback` (default: end).
function nullableTime(value: string | null, fallback = Infinity): number {
  if (!value) return fallback
  const t = new Date(value).getTime()
  return Number.isNaN(t) ? fallback : t
}

export type IssueFilter = {
  query?: string
  assignee?: string
  label?: string
  priority?: number
  milestone?: string
}

export function filterIssues(issues: PublicIssue[], f: IssueFilter): PublicIssue[] {
  const q = f.query?.trim().toLowerCase()
  return issues.filter((i) => {
    if (q && !`${i.title} ${i.identifier}`.toLowerCase().includes(q)) return false
    if (f.assignee && i.assignee?.name !== f.assignee) return false
    if (f.label && !i.labels.some((l) => l.name === f.label)) return false
    if (f.priority !== undefined && i.priority !== f.priority) return false
    if (f.milestone && i.milestone !== f.milestone) return false
    return true
  })
}
