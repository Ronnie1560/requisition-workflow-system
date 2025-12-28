/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'status-draft': '#BBDEFB',
        'status-pending': '#FFF9C4',
        'status-approval': '#FFCCBC',
        'status-approved': '#C8E6C9',
        'status-receiving': '#B2DFDB',
        'status-closed': '#D7CCC8',
        'status-rejected': '#FFCDD2',
      },
    },
  },
  plugins: [],
}
