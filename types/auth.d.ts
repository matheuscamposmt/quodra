declare module '#auth-utils' {
  // Single-tenant admin session. Presence of `user.admin === true` === logged-in admin.
  interface User {
    admin: boolean
  }
  interface UserSession {
    // Slugs of password-protected boards this visitor has unlocked.
    unlocked?: string[]
  }
}

export {}
