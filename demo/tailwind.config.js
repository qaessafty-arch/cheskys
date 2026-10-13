/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'media',
  theme: {
    extend: {
      colors: {
        'app-bg': '#080B12',
        'panel-bg': '#10151F',
        'panel-hover': '#181F2A',
        'primary-accent': '#F5B83D',
        'secondary-accent': '#6EE7B7',
        'tertiary-accent': '#60A5FA',
        'danger': '#FB7185',
        'text-main': '#F8FAFC',
        'text-muted': '#94A3B8',
        'text-dim': '#64748B',
        'glass-bg': 'rgba(255,255,255,0.04)',
        'glass-bg-hover': 'rgba(255,255,255,0.08)',
        'glass-border': 'rgba(255,255,255,0.1)',
        'glass-border-strong': 'rgba(255,255,255,0.15)',
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        body: ['DM Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
        'spin-slow': 'spin 3s linear infinite',
      },
    },
  },
  plugins: [],
}