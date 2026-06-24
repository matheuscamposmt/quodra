import { linearClient } from './linear'
import { buildTriagePayload, triagePriorityToLinear } from './linearMapper'

export type TriageInput = {
  apiKey: string
  projectId: string
  teamId: string | null
  requesterName: string
  requesterEmail?: string
  title: string
  description?: string
  type?: string
  priorityLabel?: string
}

/**
 * Creates a Linear issue from an external stakeholder request. When the resolved
 * team has Triage enabled, an issue created without a workflow state lands in the
 * team's Triage queue — exactly where the owner reviews incoming requests.
 *
 * teamId falls back to the project's first team when not explicitly configured
 * on the share link.
 */
export async function createTriageIssue(input: TriageInput): Promise<{ identifier: string }> {
  const linear = linearClient(input.apiKey)

  let teamId = input.teamId
  if (!teamId) {
    const project = await linear.project(input.projectId)
    const teams = await project.teams({ first: 1 })
    teamId = teams.nodes[0]?.id ?? null
  }
  if (!teamId) {
    throw new Error(`No team resolvable for project ${input.projectId}`)
  }

  const { title, description } = buildTriagePayload({
    requesterName: input.requesterName,
    requesterEmail: input.requesterEmail,
    title: input.title,
    description: input.description,
    type: input.type,
    priorityLabel: input.priorityLabel,
  })

  const priority = input.priorityLabel ? triagePriorityToLinear(input.priorityLabel) : 0
  const payload = await linear.createIssue({
    teamId,
    projectId: input.projectId,
    title,
    description,
    ...(priority ? { priority } : {}),
  })

  const issue = await payload.issue
  return { identifier: issue?.identifier ?? '' }
}
