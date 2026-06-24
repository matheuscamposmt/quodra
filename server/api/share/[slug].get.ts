import { getLinkBySlug } from '~/server/db/scoped'
import { buildBoardResponse } from '~/server/utils/board'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')!

  const link = await getLinkBySlug(slug)
  if (!link || !link.active) {
    throw createError({ statusCode: 404, message: 'Link não encontrado' })
  }

  if (link.passwordHash) {
    const session = await getUserSession(event)
    if (!session.unlocked?.includes(slug)) {
      return {
        requiresPassword: true,
        projectName: link.label ?? link.projectName ?? '',
      }
    }
  }

  // Don't count the silent hourly auto-refresh (it sends ?refresh=1) as a view.
  const countView = !getQuery(event).refresh
  return buildBoardResponse(event, link, { countView })
})
