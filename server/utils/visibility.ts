import type { KanbanColumn, PublicIssue } from './linearMapper'

// Per-link visibility: lets the owner show clients only the relevant slice of a
// board. Applied SERVER-SIDE before the board is sent, so hidden issues/fields
// never reach the client.
export type VisibilityConfig = {
  hiddenLabels: string[]   // issues carrying any of these labels are removed
  hiddenStatuses: string[] // whole columns (by status name) are removed
  hideEstimate: boolean
  hideAssignee: boolean
  hideDueDate: boolean
  hidePriority: boolean
}

export function applyVisibility(columns: KanbanColumn[], cfg: VisibilityConfig): KanbanColumn[] {
  const hiddenLabels = new Set(cfg.hiddenLabels)
  const hiddenStatuses = new Set(cfg.hiddenStatuses)

  return columns
    .filter((c) => !hiddenStatuses.has(c.status))
    .map((c) => ({
      ...c,
      issues: c.issues
        .filter((i) => !i.labels.some((l) => hiddenLabels.has(l.name)))
        .map((i): PublicIssue => ({
          ...i,
          estimate: cfg.hideEstimate ? null : i.estimate,
          assignee: cfg.hideAssignee ? null : i.assignee,
          dueDate: cfg.hideDueDate ? null : i.dueDate,
          priority: cfg.hidePriority ? 0 : i.priority,
        })),
    }))
}
