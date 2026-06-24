export default defineNuxtConfig({
  devtools: { enabled: false },
  modules: ['nuxt-auth-utils', '@nuxtjs/tailwindcss'],

  app: {
    head: {
      htmlAttrs: { lang: 'pt-BR' },
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' },
        { rel: 'icon', type: 'image/png', href: '/favicon.png' },
        { rel: 'apple-touch-icon', href: '/logo-192.png' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap',
        },
      ],
    },
  },

  // App lives at the root of its own domain now (no more /share/ sub-path).
  runtimeConfig: {
    // Admin password for single-tenant owner authentication.
    adminPassword: '',
    // Linear API key (single-tenant).
    linearApiKey: '',
    // Note: the Postgres URL is read directly from process.env
    // (DATABASE_URL / NUXT_DATABASE_URL) in server/db/index.ts at module load,
    // so it is intentionally not declared as a runtimeConfig key here.
    public: {
      // Public origin, used to build shareable /s/<slug> URLs. No trailing slash.
      siteUrl: 'http://localhost:3001',
    },
  },

  nitro: {
    preset: 'node-server',
  },
})
