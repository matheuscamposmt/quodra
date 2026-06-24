import { eq, desc, sql } from 'drizzle-orm'
import { db, withRetry } from './index'
import { shareLinks } from './schema'
import type { ShareLink } from './schema'

// Single-tenant: every link belongs to the one instance. The only "scope" left is
// the globally-unique slug on the public board path.

export async function listLinks(): Promise<ShareLink[]> {
  return db.select().from(shareLinks).orderBy(desc(shareLinks.createdAt))
}

export async function createLink(values: {
  slug: string
  projectId: string
  projectName: string | null
  passwordHash: string | null
  label: string | null
  isPublic: boolean
  triageEnabled: boolean
  triageTeamId: string | null
  hiddenLabels?: string | null
  hiddenStatuses?: string | null
  hideEstimate?: boolean
  hideAssignee?: boolean
  hideDueDate?: boolean
  hidePriority?: boolean
  clientName?: string | null
  clientLogoUrl?: string | null
}): Promise<ShareLink> {
  const [link] = await db.insert(shareLinks).values(values).returning()
  return link
}

/** Analytics: bump the view counter and stamp last access (best-effort). */
export async function recordLinkView(id: string): Promise<void> {
  await db
    .update(shareLinks)
    .set({ viewCount: sql`${shareLinks.viewCount} + 1`, lastViewedAt: new Date() })
    .where(eq(shareLinks.id, id))
}

/** Hard delete: the slug stops resolving for good. */
export async function deleteLink(id: string): Promise<ShareLink | undefined> {
  const [link] = await db.delete(shareLinks).where(eq(shareLinks.id, id)).returning()
  return link
}

export async function setLinkActive(id: string, active: boolean): Promise<ShareLink | undefined> {
  const [link] = await db.update(shareLinks).set({ active }).where(eq(shareLinks.id, id)).returning()
  return link
}

// Public path: resolve a board by globally-unique slug. Retried once on transient blips.
export async function getLinkBySlug(slug: string): Promise<ShareLink | undefined> {
  return withRetry(async () => {
    const [link] = await db.select().from(shareLinks).where(eq(shareLinks.slug, slug))
    return link
  })
}

export async function backfillLinkProjectName(id: string, projectName: string): Promise<void> {
  await db.update(shareLinks).set({ projectName }).where(eq(shareLinks.id, id))
}
