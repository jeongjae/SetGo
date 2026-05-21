/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        slate: {
          250: '#d7e0eb',
          350: '#b4c2d3',
          450: '#8191a8',
          455: '#74859d',
          550: '#56657c',
          650: '#3f4d63',
          750: '#28364b',
          850: '#152033',
          955: '#07101f',
        },
        cyan: {
          455: '#16c7e6',
          850: '#164e63',
        },
        emerald: {
          450: '#22c786',
        },
        amber: {
          250: '#fbd38d',
          450: '#f7ad21',
        },
        rose: {
          350: '#fb8ca5',
          450: '#fb5a7b',
          455: '#f4496d',
        },
      },
      spacing: {
        '0.2': '0.05rem',
        '4.5': '1.125rem',
        '8.5': '2.125rem',
      },
    },
  },
  plugins: [],
};
