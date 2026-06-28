import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        base: '#080C18',
        surface: '#0F1625',
        elevated: '#162030',
        line: '#1E2D45',
        primary: {
          DEFAULT: '#3D6BFF',
          dark: '#2A52CC',
        },
        ai: '#7C3AED',
        teal: '#00C896',
        ink: '#EEF2FF',
        mist: '#8892A4',
        fog: '#4A5568',
      },
      keyframes: {
        orbPulse: {
          '0%, 100%': { opacity: '0.25' },
          '50%': { opacity: '0.5' },
        },
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'orb-pulse': 'orbPulse 4s ease-in-out infinite',
        'orb-pulse-slow': 'orbPulse 7s ease-in-out infinite',
        'fade-up': 'fadeUp 0.4s ease-out forwards',
      },
    },
  },
  plugins: [],
} satisfies Config
