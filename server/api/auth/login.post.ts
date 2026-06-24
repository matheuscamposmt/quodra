import { checkAdminPassword } from '~/server/utils/auth'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const body = await readBody<{ password?: string }>(event)
  const password = body?.password ?? ''

  if (!checkAdminPassword(password, config.adminPassword)) {
    throw createError({ statusCode: 401, message: 'Senha incorreta' })
  }

  await setUserSession(event, { user: { admin: true } })
  return { ok: true }
})
