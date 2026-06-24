import { vi, describe, it, expect, beforeEach } from 'vitest'
import { LinearClient } from '@linear/sdk'
import { clearCache } from '../server/utils/linearCache'

// vitest 4's automock no longer yields a constructable mock for @linear/sdk's
// class export, so provide an explicit constructor mock we drive per-test.
vi.mock('@linear/sdk', () => ({ LinearClient: vi.fn() }))

type GqlIssue = {
  identifier: string
  title: string
  priority: number
  dueDate: string | null
  state: { name: string; color: string; type: string } | null
  assignee: { name: string; avatarUrl: string | null } | null
  labels: { nodes: { name: string; color: string }[] } | null
}

const makeIssue = (overrides: Partial<GqlIssue> = {}): GqlIssue => ({
  identifier: 'PRJ-1',
  title: 'Test Issue',
  priority: 2,
  dueDate: '2026-06-01',
  state: { name: 'In Progress', color: '#f97316', type: 'started' },
  assignee: { name: 'Jane Doe', avatarUrl: 'https://example.com/a.png' },
  labels: { nodes: [] },
  ...overrides,
})

function mockClient(issues: GqlIssue[], projectName = 'My Project', targetDate: string | null = null) {
  // Regular function (not an arrow): vitest 4 invokes the implementation with
  // `new`, and arrow functions aren't constructable. A constructor returning an
  // object yields that object as the instance.
  vi.mocked(LinearClient).mockImplementation(function () {
    return {
      client: {
        rawRequest: vi.fn().mockResolvedValue({
          data: { project: { name: projectName, targetDate, issues: { nodes: issues } } },
        }),
      },
    } as unknown as LinearClient
  })
}

const { fetchLinearData } = await import('../server/utils/fetchLinearData')

beforeEach(() => {
  clearCache()
  mockClient([makeIssue()])
})

describe('fetchLinearData', () => {
  it('returns the project name and meta', async () => {
    const result = await fetchLinearData('proj-id', 'token')
    expect(result.projectName).toBe('My Project')
    expect(result.project.total).toBe(1)
  })

  it('groups issues into kanban columns with status type', async () => {
    const result = await fetchLinearData('proj-id', 'token')
    expect(result.columns).toHaveLength(1)
    expect(result.columns[0].status).toBe('In Progress')
    expect(result.columns[0].color).toBe('#f97316')
    expect(result.columns[0].type).toBe('started')
  })

  it('maps issue fields including labels', async () => {
    clearCache()
    mockClient([makeIssue({ labels: { nodes: [{ name: 'bug', color: '#ef4444' }] } })])
    const result = await fetchLinearData('proj-id', 'token')
    expect(result.columns[0].issues[0]).toMatchObject({
      identifier: 'PRJ-1',
      title: 'Test Issue',
      priority: 2,
      dueDate: '2026-06-01',
      status: 'In Progress',
      statusType: 'started',
      labels: [{ name: 'bug', color: '#ef4444' }],
    })
  })

  it('coerces missing dueDate and assignee to null', async () => {
    clearCache()
    mockClient([makeIssue({ dueDate: null, assignee: null })])
    const result = await fetchLinearData('proj-id', 'token')
    expect(result.columns[0].issues[0].dueDate).toBeNull()
    expect(result.columns[0].issues[0].assignee).toBeNull()
  })

  it('uses fallback color/type when state is null', async () => {
    clearCache()
    mockClient([makeIssue({ state: null })])
    const result = await fetchLinearData('proj-id', 'token')
    expect(result.columns[0].color).toBe('#6b7280')
    expect(result.columns[0].type).toBe('unstarted')
  })

  it('caches results per project (second call does not hit the API)', async () => {
    const rawRequest = vi.fn().mockResolvedValue({
      data: { project: { name: 'Cached', targetDate: null, issues: { nodes: [makeIssue()] } } },
    })
    vi.mocked(LinearClient).mockImplementation(function () { return { client: { rawRequest } } as unknown as LinearClient })
    clearCache()

    await fetchLinearData('cache-key', 'token')
    await fetchLinearData('cache-key', 'token')
    expect(rawRequest).toHaveBeenCalledTimes(1)
  })

  it('does not share cache across different projects', async () => {
    const rawRequest = vi.fn().mockResolvedValue({
      data: { project: { name: 'P', targetDate: null, issues: { nodes: [makeIssue()] } } },
    })
    vi.mocked(LinearClient).mockImplementation(function () { return { client: { rawRequest } } as unknown as LinearClient })
    clearCache()

    await fetchLinearData('project-A', 'token')
    await fetchLinearData('project-B', 'token')
    expect(rawRequest).toHaveBeenCalledTimes(2)
  })

  it('computes project progress from completed issues', async () => {
    clearCache()
    mockClient([
      makeIssue({ identifier: 'A', state: { name: 'Done', color: '#22c55e', type: 'completed' } }),
      makeIssue({ identifier: 'B', state: { name: 'Done', color: '#22c55e', type: 'completed' } }),
      makeIssue({ identifier: 'C', state: { name: 'Doing', color: '#f97316', type: 'started' } }),
      makeIssue({ identifier: 'D', state: { name: 'Doing', color: '#f97316', type: 'started' } }),
    ])
    const result = await fetchLinearData('proj-id', 'token')
    expect(result.project.progress).toBe(0.5)
    expect(result.project.completed).toBe(2)
  })
})
