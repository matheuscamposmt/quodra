import { describe, it, expect } from 'vitest'
import { linearClient } from '../server/utils/linear'

describe('linearClient', () => {
  it('builds a LinearClient from an api key (no throw)', () => {
    const c = linearClient('lin_api_test')
    expect(c).toBeTruthy()
    expect(typeof c.client.rawRequest).toBe('function')
  })
})
