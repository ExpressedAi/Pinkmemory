/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        pastel: {
          pink: '#FFE5EC',
          purple: '#E5E1FF',
          yellow: '#FFF3DC',
          blue: '#E5F4FF',
        }
      },
      animation: {
        blink: 'blink 0.85s step-end infinite',
      },
      keyframes: {
        blink: {
          'from, to': { borderColor: 'transparent' },
          '50%': { borderColor: 'currentColor' },
        },
      },
      boxShadow: {
        'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'DEFAULT': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px -1px rgba(0, 0, 0, 0.05)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -4px rgba(0, 0, 0, 0.05)',
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"SF Pro Text"',
          '"Helvetica Neue"',
          'Arial',
          'sans-serif'
        ],
        mono: [
          'Menlo',
          '"SF Mono"',
          'Monaco',
          '"Courier New"',
          'monospace'
        ],
      },
    },
  },
  plugins: [],
};