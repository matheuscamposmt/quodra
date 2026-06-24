import bcrypt from 'bcryptjs'
import { getLinkBySlug } from '~/server/db/scoped'
import { buildBoardResponse } from '~/server/utils/board'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')!
  const body = await readBody<{ password?: string }>(event)

  if (!body?.password || body.password.length > 1024) {
    throw createError({ statusCode: 400, message: 'Senha inválida' })
  }

  const link = await getLinkBySlug(slug)
  if (!link || !link.active) {
    throw createError({ statusCode: 404, message: 'Link não encontrado' })
  }
  if (!link.passwordHash) {
    throw createError({ statusCode: 400, message: 'Este link não requer senha' })
  }

  const valid = await bcrypt.compare(body.password, link.passwordHash)
  if (!valid) {
    throw createError({ statusCode: 401, message: 'Senha incorreta' })
  }

  // Remember this unlock in the sealed session (merged with any existing unlocks).
  const session = await getUserSession(event)
  const unlocked = Array.from(new Set([...(session.unlocked ?? []), slug]))
  await setUserSession(event, { unlocked }, { maxAge: 60 * 60 * 24 })

  // Unlocking is a real open — count it.
  return buildBoardResponse(event, link, { countView: true })
})
