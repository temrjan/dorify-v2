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
    },
  },
  plugins: [],
};

export default config;
