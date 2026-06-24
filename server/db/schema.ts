import { pgTable, uuid, text, boolean, timestamp, integer } from 'drizzle-orm/pg-core'

// Single-tenant: one instance = one Linear account. No org/user tables.
export const shareLinks = pgTable('share_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(), // nanoid(12) — the public part of the URL
  projectId: text('project_id').notNull(),
  projectName: text('project_name'),
  passwordHash: text('password_hash'), // bcrypt; null when public
  label: text('label'),
  isPublic: boolean('is_public').notNull().default(false),
  triageEnabled: boolean('triage_enabled').notNull().default(true),
  triageTeamId: text('triage_team_id'),
  active: boolean('active').notNull().default(true), // soft-delete
  hiddenLabels: text('hidden_labels'),
  hiddenStatuses: text('hidden_statuses'),
  hideEstimate: boolean('hide_estimate').notNull().default(false),
  hideAssignee: boolean('hide_assignee').notNull().default(false),
  hideDueDate: boolean('hide_due_date').notNull().default(false),
  hidePriority: boolean('hide_priority').notNull().default(false),
  showProjectUpdates: boolean('show_project_updates').notNull().default(true),
  clientName: text('client_name'),
  clientLogoUrl: text('client_logo_url'),
  viewCount: integer('view_count').notNull().default(0),
  lastViewedAt: timestamp('last_viewed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type ShareLink = typeof shareLinks.$inferSelect
