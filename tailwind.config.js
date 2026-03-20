/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Claude.ai Warm Cream Theme
        'sidebar': {
          DEFAULT: '#F5F3EE',
          hover: '#EBE9E3',
          active: '#E0DDD6',
        },
        'chat': {
          bg: '#FAFAF7',
          input: '#FFFFFF',
          hover: '#F0EDE6',
        },
        'agent-panel': {
          bg: '#FAFAF7',
          border: '#E5E2DB',
        },
        'text': {
          primary: '#1A1815',
          secondary: '#6F6B66',
          muted: '#A8A39E',
        },
        'accent': {
          primary: '#C96442',
          hover: '#B55836',
          light: '#F5DDD3',
          dark: '#A04E30',
        },
        'platinum': {
          50: '#FAFAF7',
          100: '#F5F3EE',
          200: '#EEEDEA',
          300: '#E5E2DB',
          400: '#D6D2CA',
          500: '#C4BFB7',
          600: '#A8A39E',
          700: '#78736E',
        },
        'rosegold': {
          50: '#FDF8F5',
          100: '#FAEDE6',
          200: '#F5DDD3',
          300: '#E0B8A4',
          400: '#C96442',
          500: '#B55836',
          600: '#A04E30',
        },
      },
      backgroundImage: {
        'gradient-luxury': 'linear-gradient(135deg, #FAFAF7 0%, #F5F3EE 50%, #EEEDEA 100%)',
        'gradient-accent': 'linear-gradient(135deg, #F5DDD3 0%, #C96442 100%)',
        'gradient-platinum': 'linear-gradient(180deg, #FAFAF7 0%, #F5F3EE 100%)',
        'gradient-elegant': 'linear-gradient(135deg, #FAFAF7 0%, #F7F5F0 100%)',
      },
      boxShadow: {
        'luxury': '0 1px 3px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
        'luxury-md': '0 4px 12px rgba(0, 0, 0, 0.05), 0 2px 4px rgba(0, 0, 0, 0.03)',
        'luxury-lg': '0 10px 40px rgba(0, 0, 0, 0.06), 0 4px 12px rgba(0, 0, 0, 0.04)',
        'accent': '0 4px 16px rgba(201, 100, 66, 0.15)',
      },
      borderColor: {
        'elegant': 'rgba(0, 0, 0, 0.06)',
      },
    },
  },
  plugins: [],
}
