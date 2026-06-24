import { getLinkBySlug } from '~/server/db/scoped'
import { getLinearApiKey } from '~/server/utils/linear'
import { createTriageIssue } from '~/server/utils/createTriageIssue'
import { isValidEmail } from '~/server/utils/email'

const LIMITS = { name: 120, title: 256, description: 5000, email: 200 }
const TYPES = ['Bug', 'Melhoria', 'Dúvida', 'Outro']
const PRIORITIES = ['Urgente', 'Alta', 'Média', 'Baixa']

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')!

  const link = await getLinkBySlug(slug)
  if (!link || !link.active) {
    throw createError({ statusCode: 404, message: 'Link não encontrado' })
  }
  if (!link.triageEnabled) {
    throw createError({ statusCode: 403, message: 'Solicitações desativadas para este link' })
  }

  // Triage requires the same access level as viewing the board.
  if (link.passwordHash) {
    const session = await getUserSession(event)
    if (!session.unlocked?.includes(slug)) {
      throw createError({ statusCode: 401, message: 'Não autorizado' })
    }
  }

  const body = await readBody<{
    requesterName?: string
    requesterEmail?: string
    title?: string
    description?: string
    type?: string
    priority?: string
  }>(event)
  const requesterName = (body?.requesterName ?? '').trim()
  const requesterEmail = (body?.requesterEmail ?? '').trim()
  const title = (body?.title ?? '').trim()
  const description = (body?.description ?? '').trim()
  // Only accept known values; anything else is dropped (no free-text injection).
  const type = TYPES.includes(body?.type ?? '') ? body!.type : undefined
  const priorityLabel = PRIORITIES.includes(body?.priority ?? '') ? body!.priority : undefined

  if (!requesterName || requesterName.length > LIMITS.name) {
    throw createError({ statusCode: 400, message: 'Nome inválido' })
  }
  if (requesterEmail && (requesterEmail.length > LIMITS.email || !isValidEmail(requesterEmail))) {
    throw createError({ statusCode: 400, message: 'Email inválido' })
  }
  if (!title || title.length > LIMITS.title) {
    throw createError({ statusCode: 400, message: 'Título inválido' })
  }
  if (description.length > LIMITS.description) {
    throw createError({ statusCode: 400, message: 'Descrição muito longa' })
  }

  try {
    const apiKey = getLinearApiKey(event)
    const { identifier } = await createTriageIssue({
      apiKey,
      projectId: link.projectId,
      teamId: link.triageTeamId,
      requesterName,
      requesterEmail: requesterEmail || undefined,
      title,
      description,
      type,
      priorityLabel,
    })
    return { ok: true, identifier }
  } catch (e) {
    console.error('[triage] failed to create issue', e)
    throw createError({ statusCode: 502, message: 'Falha ao criar solicitação' })
  }
})
