import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        dorify: {
          primary: '#60A5FA',
          'primary-dark': '#3B82F6',
          'primary-light': '#DBEAFE',
          secondary: '#FA6079',
          'secondary-light': '#FEE2E8',
          success: '#34C759',
          'success-light': '#DCFCE7',
          warning: '#F59E0B',
          'warning-light': '#FEF3C7',
          error: '#EF4444',
          'error-light': '#FEE2E2',
        },
      },
      fontFamily: {
        sans: [
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Roboto',
          'Helvetica Neue',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.06)',
        'card-hover':
          '0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.06)',
        sheet: '0 -8px 24px -4px rgb(0 0 0 / 0.12)',
      },
      borderRadius: {
        card: '12px',
        sheet: '20px',
      },
    },
  },
  plugins: [],
};

export default config;
