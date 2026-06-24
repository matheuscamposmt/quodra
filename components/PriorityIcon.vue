<script setup lang="ts">
import { priorityLabel } from '~/server/utils/linearMapper'

const props = withDefaults(
  defineProps<{ priority: 0 | 1 | 2 | 3 | 4; size?: number }>(),
  { size: 14 }
)

const label = computed(() => priorityLabel(props.priority))

// Number of lit bars for the 3-bar variants (High=3, Medium=2, Low=1, None=0).
const litBars = computed(() => {
  switch (props.priority) {
    case 2: return 3
    case 3: return 2
    case 4: return 1
    default: return 0
  }
})

const bars = [
  { x: 1.5, y: 8.5, h: 3.5 },
  { x: 5.5, y: 6, h: 6 },
  { x: 9.5, y: 3.5, h: 8.5 },
]
</script>

<template>
  <svg
    :width="size" :height="size" viewBox="0 0 14 14"
    fill="none" class="shrink-0" :aria-label="label" role="img"
  >
    <!-- urgent: filled amber square with exclamation -->
    <template v-if="priority === 1">
      <rect x="1" y="1" width="12" height="12" rx="2.5" fill="#f2994a" />
      <rect x="6.3" y="3.2" width="1.4" height="5" rx="0.7" fill="#fff" />
      <rect x="6.3" y="9.4" width="1.4" height="1.6" rx="0.7" fill="#fff" />
    </template>

    <!-- none / low / medium / high: three ascending bars -->
    <template v-else>
      <rect
        v-for="(b, i) in bars"
        :key="i"
        :x="b.x" :y="b.y" :width="3" :height="b.h" rx="1"
        :fill="i < litBars ? '#a1a1aa' : '#3f3f46'"
      />
    </template>
  </svg>
</template>
