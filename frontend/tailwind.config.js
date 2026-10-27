/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bb: {
          bg: '#0a0c10',
          card: '#0f1218',
          elevated: '#141820',
          border: '#1e2530',
          borderActive: '#2a3545',
          orange: '#ff6600',
          profit: '#00d084',
          loss: '#ff3b3b',
          warning: '#ffd700',
        },
        tilt: {
          green: '#00d084',
          yellow: '#ffd700',
          orange: '#ff6600',
          red: '#ff3b3b',
          dark: '#0a0c10',
          card: '#0f1218',
          cardBorder: '#1e2530',
          subtle: '#2a3545',
        }
      },
      fontFamily: {
        mono: ['"IBM Plex Mono"', 'JetBrains Mono', 'Menlo', 'Monaco', 'Courier New', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
      }
    },
  },
  plugins: [],
}
