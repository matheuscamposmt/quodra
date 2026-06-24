import type { Config } from 'tailwindcss'

// Quodra design system (see DESIGN.md). Inter carries the whole hierarchy;
// JetBrains Mono is reserved for board issue IDs and code in screenshots.
export default <Partial<Config>>{
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      // The "house" ease-out curve + one quiet entrance animation (used on load,
      // never on scroll). motion-safe: gates it; reduced-motion users skip it.
      transitionTimingFunction: { quodra: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      keyframes: {
        rise: { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: { rise: 'rise 0.5s cubic-bezier(0.22,1,0.36,1) both' },
    },
  },
}
