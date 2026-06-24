<script setup lang="ts">
useHead({ title: 'Entrar · Quodra' })
const { loggedIn, fetch: refreshSession } = useUserSession()
if (loggedIn.value) navigateTo('/app')

const password = ref('')
const error = ref('')
const busy = ref(false)

async function submit() {
  if (!password.value || busy.value) return
  busy.value = true
  error.value = ''
  try {
    await $fetch('/api/auth/login', { method: 'POST', body: { password: password.value } })
    await refreshSession()
    await navigateTo('/app')
  } catch (e: unknown) {
    error.value = (e as { data?: { message?: string } })?.data?.message ?? 'Senha incorreta'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center bg-[#fbfaf7] px-6 font-sans text-[#1b1815]">
    <form class="w-full max-w-sm rounded-2xl border border-[#e5dfd5] bg-white p-8 shadow-sm" @submit.prevent="submit">
      <div class="mb-6 flex items-center gap-2.5">
        <img src="/logo.svg" alt="Quodra" class="h-8 w-8" />
        <span class="text-xl font-semibold tracking-tight">Quodra</span>
      </div>
      <label class="block text-sm font-medium text-[#3a352f]" for="pw">Senha de acesso</label>
      <input
        id="pw" v-model="password" type="password" autocomplete="current-password" autofocus
        class="mt-1.5 w-full rounded-lg border border-[#e5dfd5] px-3 py-2 outline-none focus:border-[#5e6ad2]"
      />
      <p v-if="error" class="mt-2 text-sm text-red-600">{{ error }}</p>
      <button
        type="submit" :disabled="busy || !password"
        class="mt-5 w-full rounded-lg bg-[#5e6ad2] px-4 py-2.5 font-medium text-white transition-colors hover:bg-[#424aa2] disabled:opacity-50"
      >{{ busy ? 'Entrando...' : 'Entrar' }}</button>
    </form>
  </div>
</template>
