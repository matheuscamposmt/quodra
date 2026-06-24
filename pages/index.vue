<script setup lang="ts">
// Open-source edition: no landing. Go straight to the panel.
definePageMeta({ middleware: 'auth' })
useHead({ title: 'Quodra' })
onMounted(() => navigateTo('/app'))
</script>

<template>
  <div class="min-h-screen bg-[#fbfaf7]" />
</template>
