<script setup lang="ts">
const props = defineProps<{ slug: string }>()
const emit = defineEmits<{ close: [] }>()

const TYPES = ['Bug', 'Melhoria', 'Dúvida', 'Outro'] as const
const PRIORITIES = ['Baixa', 'Média', 'Alta', 'Urgente'] as const

const requesterName = ref('')
const requesterEmail = ref('')
const type = ref<(typeof TYPES)[number]>('Melhoria')
const priority = ref<(typeof PRIORITIES)[number] | ''>('')
const title = ref('')
const description = ref('')

const submitting = ref(false)
const error = ref('')
const createdIdentifier = ref<string | null>(null)

const canSubmit = computed(
  () => requesterName.value.trim().length > 0 && title.value.trim().length > 0 && !submitting.value
)

async function submit() {
  if (!canSubmit.value) return
  submitting.value = true
  error.value = ''
  try {
    const result = await $fetch<{ ok: boolean; identifier: string }>(
      `/api/share/${props.slug}/triage`,
      {
        method: 'POST',
        body: {
          requesterName: requesterName.value,
          requesterEmail: requesterEmail.value,
          type: type.value,
          priority: priority.value,
          title: title.value,
          description: description.value,
        },
      }
    )
    createdIdentifier.value = result.identifier || 'criada'
  } catch (e: unknown) {
    error.value =
      (e as { data?: { message?: string } })?.data?.message ?? 'Não foi possível enviar'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
    @click.self="emit('close')"
  >
    <div class="w-full max-w-md rounded-xl border border-[#e7e1d7] bg-[#f6f4ef] shadow-2xl">
      <div class="flex items-center justify-between border-b border-[#e7e1d7] px-5 py-4">
        <h2 class="text-sm font-semibold text-[#1b1815]">Nova solicitação</h2>
        <button class="text-[#6b6258] transition-colors hover:text-[#1b1815]" aria-label="Fechar" @click="emit('close')">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>

      <!-- success -->
      <div v-if="createdIdentifier" class="space-y-4 p-6 text-center">
        <div class="flex justify-center">
          <span class="flex h-10 w-10 items-center justify-center rounded-full bg-[#5e6ad2]/15">
            <svg class="h-5 w-5 text-[#5e6ad2]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>
          </span>
        </div>
        <div>
          <p class="text-sm text-[#1b1815]">Recebemos sua solicitação.</p>
          <p class="mt-1 text-sm text-[#6b6258]">O time foi notificado e ela já está na triagem.</p>
          <p v-if="createdIdentifier !== 'criada'" class="mt-3 inline-block rounded-md border border-[#e7e1d7] bg-black/[0.04] px-2.5 py-1 text-xs text-[#3a352f]">
            Referência: <span class="font-medium text-[#1b1815]">{{ createdIdentifier }}</span>
          </p>
        </div>
        <button
          class="w-full rounded-lg bg-[#5e6ad2] py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#828fff]"
          @click="emit('close')"
        >Fechar</button>
      </div>

      <!-- form -->
      <form v-else class="space-y-4 p-5" @submit.prevent="submit">
        <div class="space-y-1.5">
          <label class="text-xs text-[#6b6258]">Tipo</label>
          <div class="grid grid-cols-4 gap-1.5">
            <button
              v-for="t in TYPES" :key="t" type="button"
              class="rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors"
              :class="type === t ? 'border-[#5e6ad2]/50 bg-[#5e6ad2]/10 text-[#5e6ad2]' : 'border-[#e7e1d7] text-[#6b6258] hover:border-[#d8cfc0]'"
              @click="type = t"
            >{{ t }}</button>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-1.5">
            <label class="text-xs text-[#6b6258]">Seu nome</label>
            <div class="relative">
              <svg class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a99f90]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM4 21v-1a6 6 0 0112 0v1" /></svg>
              <input v-model="requesterName" type="text" maxlength="120" placeholder="Como te identificar"
                class="w-full rounded-lg border border-[#e7e1d7] bg-black/[0.04] py-2 pl-9 pr-3 text-sm text-[#1b1815] placeholder-[#a99f90] outline-none transition-colors focus:border-[#5e6ad2]/60 focus:ring-1 focus:ring-[#5e6ad2]/40" />
            </div>
          </div>
          <div class="space-y-1.5">
            <label class="text-xs text-[#6b6258]">Email <span class="text-[#8a8175]">(opcional)</span></label>
            <div class="relative">
              <svg class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a99f90]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2" /><path stroke-linecap="round" stroke-linejoin="round" d="M3 7l9 6 9-6" /></svg>
              <input v-model="requesterEmail" type="email" maxlength="200" placeholder="para retorno"
                class="w-full rounded-lg border border-[#e7e1d7] bg-black/[0.04] py-2 pl-9 pr-3 text-sm text-[#1b1815] placeholder-[#a99f90] outline-none transition-colors focus:border-[#5e6ad2]/60 focus:ring-1 focus:ring-[#5e6ad2]/40" />
            </div>
          </div>
        </div>

        <div class="space-y-1.5">
          <label class="text-xs text-[#6b6258]">Título</label>
          <div class="relative">
            <svg class="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#a99f90]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h10" /></svg>
            <input v-model="title" type="text" maxlength="256" placeholder="Resumo da solicitação"
              class="w-full rounded-lg border border-[#e7e1d7] bg-black/[0.04] py-2 pl-9 pr-3 text-sm text-[#1b1815] placeholder-[#a99f90] outline-none transition-colors focus:border-[#5e6ad2]/60 focus:ring-1 focus:ring-[#5e6ad2]/40" />
          </div>
        </div>

        <div class="space-y-1.5">
          <label class="text-xs text-[#6b6258]">Prioridade <span class="text-[#8a8175]">(opcional)</span></label>
          <div class="grid grid-cols-4 gap-1.5">
            <button
              v-for="p in PRIORITIES" :key="p" type="button"
              class="rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors"
              :class="priority === p ? 'border-[#5e6ad2]/50 bg-[#5e6ad2]/10 text-[#5e6ad2]' : 'border-[#e7e1d7] text-[#6b6258] hover:border-[#d8cfc0]'"
              @click="priority = priority === p ? '' : p"
            >{{ p }}</button>
          </div>
        </div>

        <div class="space-y-1.5">
          <label class="text-xs text-[#6b6258]">Descrição <span class="text-[#8a8175]">(opcional)</span></label>
          <textarea v-model="description" rows="3" maxlength="5000" placeholder="Detalhe o que você precisa"
            class="w-full resize-none rounded-lg border border-[#e7e1d7] bg-black/[0.04] px-3 py-2 text-sm text-[#1b1815] placeholder-[#a99f90] outline-none transition-colors focus:border-[#5e6ad2]/60 focus:ring-1 focus:ring-[#5e6ad2]/40" />
        </div>

        <p v-if="error" class="text-xs text-red-400">{{ error }}</p>

        <button
          type="submit" :disabled="!canSubmit"
          class="w-full rounded-lg bg-[#5e6ad2] py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#828fff] disabled:cursor-not-allowed disabled:opacity-40"
        >{{ submitting ? 'Enviando...' : 'Enviar para triagem' }}</button>
      </form>
    </div>
  </div>
</template>
