// Lightweight email checks for the optional triage requester email. No external service:
// format is a pragmatic regex (not full RFC 5322) and disposable detection is a
// curated denylist of the common throwaway providers.

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}$/

export function isValidEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim())
}

// Common disposable / throwaway email domains. Not exhaustive — covers the
// providers people actually reach for to dodge a signup form.
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'tempmail.com',
  'temp-mail.org',
  '10minutemail.com',
  'guerrillamail.com',
  'yopmail.com',
  'throwawaymail.com',
  'getnada.com',
  'trashmail.com',
  'sharklasers.com',
  'maildrop.cc',
  'dispostable.com',
  'fakeinbox.com',
  'mailnesia.com',
  'mintemail.com',
  'mohmal.com',
  'tempinbox.com',
  'emailondeck.com',
  'spamgourmet.com',
  'mailcatch.com',
])

export function isDisposableEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split('@')[1]
  if (!domain) return false
  return DISPOSABLE_DOMAINS.has(domain)
}
