import { requireAdmin } from '~/server/utils/auth'
import { listLinks } from '~/server/db/scoped'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const config = useRuntimeConfig(event)
  const links = await listLinks()
  return {
    links: links.map((l) => ({
      id: l.id,
      slug: l.slug,
      url: `${config.public.siteUrl}/s/${l.slug}`,
      projectId: l.projectId,
      projectName: l.projectName,
      label: l.label,
      hasPassword: Boolean(l.passwordHash),
      isPublic: l.isPublic,
      triageEnabled: l.triageEnabled,
      active: l.active,
      createdAt: l.createdAt,
      viewCount: l.viewCount,
      lastViewedAt: l.lastViewedAt,
    })),
  }
})
