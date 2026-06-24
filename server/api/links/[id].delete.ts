import { requireAdmin } from '~/server/utils/auth'
import { setLinkActive, deleteLink } from '~/server/db/scoped'

// DELETE ?permanent=1 → hard delete; default → soft delete (deactivate).
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')!
  const permanent = getQuery(event).permanent === '1'

  const link = permanent ? await deleteLink(id) : await setLinkActive(id, false)
  if (!link) {
    throw createError({ statusCode: 404, message: 'Link não encontrado' })
  }
  return { id: link.id, deleted: permanent }
})
