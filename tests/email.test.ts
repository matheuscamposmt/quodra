import { describe, it, expect } from 'vitest'
import { isValidEmail, isDisposableEmail } from '../server/utils/email'

describe('isValidEmail', () => {
  it.each([
    'user@example.com',
    'a.b+c@sub.domain.co',
    'maria.silva@empresa.com.br',
    'dev_99@gmail.com',
  ])('accepts %s', (email) => {
    expect(isValidEmail(email)).toBe(true)
  })

  it.each([
    '',
    'foo',
    'foo@',
    '@bar.com',
    'foo@bar',          // no TLD
    'foo bar@baz.com',  // space
    'foo@bar..com',     // double dot
    'foo@@bar.com',
  ])('rejects %s', (email) => {
    expect(isValidEmail(email)).toBe(false)
  })

  it('trims surrounding whitespace before validating', () => {
    expect(isValidEmail('  user@example.com  ')).toBe(true)
  })
})

describe('isDisposableEmail', () => {
  it.each([
    'x@mailinator.com',
    'throwaway@tempmail.com',
    'a@10minutemail.com',
    'b@guerrillamail.com',
    'c@yopmail.com',
  ])('flags disposable domain %s', (email) => {
    expect(isDisposableEmail(email)).toBe(true)
  })

  it.each([
    'me@gmail.com',
    'founder@empresa.com.br',
    'team@outlook.com',
  ])('allows real domain %s', (email) => {
    expect(isDisposableEmail(email)).toBe(false)
  })

  it('is case-insensitive on the domain', () => {
    expect(isDisposableEmail('x@MailInator.COM')).toBe(true)
  })
})
