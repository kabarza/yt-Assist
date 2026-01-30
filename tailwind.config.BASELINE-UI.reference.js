/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        lime: {
          400: '#a3e635',
          500: '#84cc16',
        }
      },
      // BASELINE-UI: Fixed z-index scale
      zIndex: {
        'dropdown': '10',
        'sticky': '20',
        'modal': '30',
        'popover': '40',
        'tooltip': '50',
      }
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
