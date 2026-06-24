import bcrypt from 'bcryptjs'
import { nanoid } from 'nanoid'
import { requireAdmin } from '~/server/utils/auth'
import { createLink } from '~/server/db/scoped'

type Body = {
  projectId?: string
  projectName?: string
  label?: string
  password?: string
  isPublic?: boolean
  triageEnabled?: boolean
  allowPublicTriage?: boolean
  triageTeamId?: string
  hiddenLabels?: string | string[]
  hideEstimate?: boolean
  hideAssignee?: boolean
  hideDueDate?: boolean
  hidePriority?: boolean
  clientName?: string
  clientLogoUrl?: string
}

// Accepts "internal, wip" or ["internal","wip"] → clean string[] → JSON for storage.
function toLabelList(v: string | string[] | undefined): string {
  const arr = Array.isArray(v) ? v : (v ?? '').split(',')
  return JSON.stringify(arr.map((s) => s.trim()).filter(Boolean))
}

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const config = useRuntimeConfig(event)
  const body = await readBody<Body>(event)

  const projectId = (body?.projectId ?? '').trim()
  const projectName = (body?.projectName ?? '').trim() || null
  const label = (body?.label ?? '').trim() || null
  const password = body?.password ?? ''
  const isPublic = body?.isPublic === true
  const triageTeamId = (body?.triageTeamId ?? '').trim() || null

  if (!projectId) {
    throw createError({ statusCode: 400, message: 'Selecione um projeto' })
  }
  if (!isPublic && !password) {
    throw createError({ statusCode: 400, message: 'Defina uma senha ou marque o link como público' })
  }
  if (password && password.length > 1024) {
    throw createError({ statusCode: 400, message: 'Senha muito longa' })
  }

  const triageEnabled = body?.triageEnabled !== false && (!isPublic || body?.allowPublicTriage === true)
  const passwordHash = password ? await bcrypt.hash(password, 12) : null

  const link = await createLink({
    slug: nanoid(12),
    projectId,
    projectName,
    passwordHash,
    label,
    isPublic,
    triageEnabled,
    triageTeamId,
    hiddenLabels: toLabelList(body?.hiddenLabels),
    hideEstimate: body?.hideEstimate === true,
    hideAssignee: body?.hideAssignee === true,
    hideDueDate: body?.hideDueDate === true,
    hidePriority: body?.hidePriority === true,
    clientName: (body?.clientName ?? '').trim() || null,
    clientLogoUrl: (body?.clientLogoUrl ?? '').trim() || null,
  })

  return { id: link.id, slug: link.slug, url: `${config.public.siteUrl}/s/${link.slug}` }
})
