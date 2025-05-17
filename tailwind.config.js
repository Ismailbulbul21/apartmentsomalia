/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eef9ff',
          100: '#dcf3ff',
          200: '#b3e7ff',
          300: '#66d4ff',
          400: '#1ab8ff',
          500: '#00a3ff',
          600: '#0084d6',
          700: '#0069ae',
          800: '#005b91',
          900: '#004c77',
          950: '#003152',
        },
        secondary: {
          50: '#faf5ff',
          100: '#f4e8ff',
          200: '#ebd5ff',
          300: '#dbb4ff',
          400: '#c384ff',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7d22c9',
          800: '#6b21a8',
          900: '#581c87',
          950: '#3b0764',
        },
        accent: {
          50: '#fff8ed',
          100: '#ffefd3',
          200: '#ffdca6',
          300: '#ffc46d',
          400: '#ffa83a',
          500: '#ff8c12',
          600: '#f97008',
          700: '#dc4f09',
          800: '#b53c0e',
          900: '#943310',
          950: '#501805',
        },
        night: {
          50: '#f6f7f9',
          100: '#eceef2',
          200: '#d5dae2',
          300: '#b0b9c7',
          400: '#8694a7',
          500: '#68778d',
          600: '#526074',
          700: '#424e5f',
          800: '#394251',
          900: '#1f2737',
          950: '#171e2a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Roboto', 'system-ui', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '2rem',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 5s ease-in-out infinite',
        'slow-spin': 'slow-spin 20s linear infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'slow-spin': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        }
      },
      boxShadow: {
        'intense': '0 10px 30px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'card': '0 4px 20px 0px rgba(0, 0, 0, 0.08)',
        'card-hover': '0 10px 30px 0px rgba(0, 0, 0, 0.12)',
        'glow': '0 0 15px 2px rgba(0, 163, 255, 0.3)',
        'glow-sm': '0 0 10px 1px rgba(0, 163, 255, 0.2)',
      },
      backgroundImage: {
        'hero-pattern': "url('/patterns/hero-pattern.svg')",
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}