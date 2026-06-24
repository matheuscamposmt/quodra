import { describe, it, expect } from 'vitest'
import { checkAdminPassword } from '../server/utils/auth'

describe('checkAdminPassword', () => {
  it('accepts the exact password', () => {
    expect(checkAdminPassword('s3cret', 's3cret')).toBe(true)
  })
  it('rejects a wrong password', () => {
    expect(checkAdminPassword('nope', 's3cret')).toBe(false)
  })
  it('rejects when no password is configured', () => {
    expect(checkAdminPassword('anything', '')).toBe(false)
  })
  it('rejects different-length input', () => {
    expect(checkAdminPassword('short', 'muchlongerpassword')).toBe(false)
  })
})
