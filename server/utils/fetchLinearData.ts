import { linearClient } from './linear'
import {
  mapToPublicIssue,
  groupByStatus,
  computeProjectMeta,
  type RawIssueData,
  type KanbanColumn,
  type ProjectMeta,
} from './linearMapper'
import { getCached, setCached } from './linearCache'

export type BoardData = {
  projectName: string
  project: ProjectMeta
  columns: KanbanColumn[]
}

const PROJECT_QUERY = `
  query ProjectShare($id: String!) {
    project(id: $id) {
      name
      targetDate
      issues(first: 250) {
        nodes {
          identifier
          title
          description
          priority
          estimate
          dueDate
          updatedAt
          projectMilestone { name }
          state { name color type }
          assignee { name avatarUrl }
          labels { nodes { name color } }
        }
      }
    }
  }
`

type GqlIssue = {
  identifier: string
  title: string
  description: string | null
  priority: number
  estimate: number | null
  dueDate: string | null
  updatedAt: string | null
  projectMilestone: { name: string } | null
  state: { name: string; color: string; type: string } | null
  assignee: { name: string; avatarUrl: string | null } | null
  labels: { nodes: { name: string; color: string }[] } | null
}

type GqlResponse = {
  project: {
    name: string
    targetDate: string | null
    issues: { nodes: GqlIssue[] }
  }
}

/**
 * Fetches a project's board in a SINGLE GraphQL request (state, assignee and
 * labels resolved inline — no per-issue N+1). Cached in memory per project
 * so repeat visits and the hourly client refresh stay cheap.
 */
export async function fetchLinearData(
  projectId: string,
  apiKey: string
): Promise<BoardData> {
  const cacheKey = `project:${projectId}`
  const cached = getCached<BoardData>(cacheKey)
  if (cached) return cached

  const linear = linearClient(apiKey)
  const { data } = await linear.client.rawRequest<GqlResponse, { id: string }>(PROJECT_QUERY, {
    id: projectId,
  })

  const project = data!.project
  const raw: RawIssueData[] = project.issues.nodes.map((n) => ({
    identifier: n.identifier,
    title: n.title,
    description: n.description ?? null,
    stateName: n.state?.name ?? 'Unknown',
    stateColor: n.state?.color ?? '#6b7280',
    stateType: n.state?.type ?? 'unstarted',
    priority: n.priority ?? 0,
    estimate: n.estimate ?? null,
    dueDate: n.dueDate ?? null,
    updatedAt: n.updatedAt ?? null,
    milestone: n.projectMilestone?.name ?? null,
    assigneeName: n.assignee?.name ?? null,
    assigneeAvatarUrl: n.assignee?.avatarUrl ?? null,
    labels: (n.labels?.nodes ?? []).map((l) => ({ name: l.name, color: l.color })),
  }))

  const issues = raw.map(mapToPublicIssue)
  const result: BoardData = {
    projectName: project.name,
    project: computeProjectMeta(project.name, project.targetDate ?? null, issues),
    columns: groupByStatus(issues),
  }

  setCached(cacheKey, result)
  return result
}

// Project status, latest written update (with health) and milestones. Fetched in
// a SEPARATE, fail-soft request so a Linear schema change here can never break the
// board itself — on any error we return null and the board renders without extras.
export type ProjectExtras = {
  state: string | null
  update: { body: string; health: string | null; createdAt: string; author: string | null } | null
  milestones: { name: string; targetDate: string | null }[]
}

const EXTRAS_QUERY = `
  query ProjectExtras($id: String!) {
    project(id: $id) {
      state
      projectUpdates(first: 1) { nodes { body health createdAt user { name } } }
      projectMilestones(first: 20) { nodes { name targetDate } }
    }
  }
`

export async function fetchProjectExtras(
  projectId: string,
  apiKey: string,
): Promise<ProjectExtras | null> {
  try {
    const linear = linearClient(apiKey)
    const { data } = await linear.client.rawRequest<{ project: any }, { id: string }>(
      EXTRAS_QUERY,
      { id: projectId },
    )
    const p = data?.project
    if (!p) return null
    const u = p.projectUpdates?.nodes?.[0] ?? null
    return {
      state: p.state ?? null,
      update: u
        ? { body: u.body ?? '', health: u.health ?? null, createdAt: u.createdAt, author: u.user?.name ?? null }
        : null,
      milestones: (p.projectMilestones?.nodes ?? []).map((m: any) => ({
        name: m.name,
        targetDate: m.targetDate ?? null,
      })),
    }
  } catch (e) {
    console.error('[linear] project extras fetch failed (non-fatal)', e)
    return null
  }
}

const PROJECTS_QUERY = `
  query Projects {
    projects(first: 100) {
      nodes { id name }
    }
  }
`

export type LinearProject = { id: string; name: string }

/** Lists the org's Linear projects for the "new link" dropdown. */
export async function fetchProjects(apiKey: string): Promise<LinearProject[]> {
  const linear = linearClient(apiKey)
  const { data } = await linear.client.rawRequest<{ projects: { nodes: LinearProject[] } }, {}>(
    PROJECTS_QUERY
  )
  return (data!.projects.nodes ?? [])
    .map((p) => ({ id: p.id, name: p.name }))
    .sort((a, b) => a.name.localeCompare(b.name))
}
