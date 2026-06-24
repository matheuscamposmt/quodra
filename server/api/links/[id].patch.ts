import { requireAdmin } from '~/server/utils/auth'
import { setLinkActive } from '~/server/db/scoped'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = getRouterParam(event, 'id')!
  const body = await readBody<{ active?: boolean }>(event)
  const active = body?.active === true

  const link = await setLinkActive(id, active)
  if (!link) {
    throw createError({ statusCode: 404, message: 'Link não encontrado' })
  }
  return { id: link.id, active: link.active }
})
