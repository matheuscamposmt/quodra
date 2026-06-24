<script setup lang="ts">
import type { StateType } from '~/server/utils/linearMapper'

const props = withDefaults(
  defineProps<{ type: StateType; color?: string; size?: number }>(),
  { color: '#6b7280', size: 14 }
)
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 14 14"
    fill="none"
    class="shrink-0"
    aria-hidden="true"
  >
    <!-- backlog: dashed ring -->
    <circle
      v-if="type === 'backlog'"
      cx="7" cy="7" r="5.5"
      :stroke="color" stroke-width="1.5"
      stroke-dasharray="1.8 1.8"
    />

    <!-- unstarted: empty ring -->
    <circle
      v-else-if="type === 'unstarted'"
      cx="7" cy="7" r="5.5"
      :stroke="color" stroke-width="1.5"
    />

    <!-- started: ring + partial pie -->
    <template v-else-if="type === 'started'">
      <circle cx="7" cy="7" r="5.5" :stroke="color" stroke-width="1.5" />
      <circle
        cx="7" cy="7" r="2.5"
        fill="none" :stroke="color" stroke-width="5"
        stroke-dasharray="7.85 15.7"
        transform="rotate(-90 7 7)"
      />
    </template>

    <!-- completed: filled circle + check -->
    <template v-else-if="type === 'completed'">
      <circle cx="7" cy="7" r="6" :fill="color" />
      <path
        d="M4.2 7.1 6.1 9 9.8 5"
        stroke="#fff" stroke-width="1.4"
        stroke-linecap="round" stroke-linejoin="round" fill="none"
      />
    </template>

    <!-- canceled: filled circle + x -->
    <template v-else>
      <circle cx="7" cy="7" r="6" fill="#6b7280" />
      <path
        d="M5 5 9 9 M9 5 5 9"
        stroke="#fff" stroke-width="1.4" stroke-linecap="round"
      />
    </template>
  </svg>
</template>
