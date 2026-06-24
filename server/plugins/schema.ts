import { ensureSchema } from '~/server/db'

// Create the schema once, at server boot, before any request handler runs.
export default defineNitroPlugin(async () => {
  try {
    await ensureSchema()
  } catch (e) {
    console.error('[db] schema bootstrap failed', e)
  }
})
