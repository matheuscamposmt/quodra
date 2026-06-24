// Guards the admin panel. Server APIs are the real gate (requireAdmin); this just
// redirects unauthenticated visitors to the login page.
export default defineNuxtRouteMiddleware(() => {
  const { loggedIn } = useUserSession()
  if (!loggedIn.value) {
    return navigateTo('/login')
  }
})
