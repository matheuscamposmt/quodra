import { requireAdmin } from '~/server/utils/auth'
import { getLinearApiKey } from '~/server/utils/linear'
import { fetchProjects } from '~/server/utils/fetchLinearData'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const apiKey = getLinearApiKey(event)
  return await fetchProjects(apiKey)
})
