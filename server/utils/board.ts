import type { H3Event } from 'h3'
import type { ShareLink } from '~/server/db/schema'
import { getLinearApiKey } from '~/server/utils/linear'
import { fetchLinearData, fetchProjectExtras } from '~/server/utils/fetchLinearData'
import { applyVisibility, type VisibilityConfig } from '~/server/utils/visibility'
import { recordLinkView, backfillLinkProjectName } from '~/server/db/scoped'

function parseList(s: string | null): string[] {
  if (!s) return []
  try {
    const v = JSON.parse(s)
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

/**
 * Builds the full client-facing board payload for a link: fetches from Linear,
 * applies per-link visibility (server-side so hidden data never leaves), adds the
 * project status/update/milestones (best-effort) and branding, and records a view.
 */
export async function buildBoardResponse(event: H3Event, link: ShareLink, opts: { countView?: boolean } = {}) {
  const apiKey = getLinearApiKey(event)
  const data = await fetchLinearData(link.projectId, apiKey)

  const cfg: VisibilityConfig = {
    hiddenLabels: parseList(link.hiddenLabels),
    hiddenStatuses: parseList(link.hiddenStatuses),
    hideEstimate: link.hideEstimate,
    hideAssignee: link.hideAssignee,
    hideDueDate: link.hideDueDate,
    hidePriority: link.hidePriority,
  }
  const columns = applyVisibility(data.columns, cfg)
  const extras = link.showProjectUpdates ? await fetchProjectExtras(link.projectId, apiKey) : null

  // White-label always on (client name/logo) + the "Feito com Quodra" badge.
  const branding = {
    clientName: link.clientName ?? null,
    clientLogoUrl: link.clientLogoUrl ?? null,
    showPoweredBy: true,
  }

  if (!link.projectName) backfillLinkProjectName(link.id, data.projectName).catch(() => {})
  if (opts.countView) recordLinkView(link.id).catch(() => {})

  return {
    projectName: data.projectName,
    project: data.project,
    columns,
    triageEnabled: link.triageEnabled,
    branding,
    state: extras?.state ?? null,
    update: extras?.update ?? null,
    milestones: extras?.milestones ?? [],
  }
}
