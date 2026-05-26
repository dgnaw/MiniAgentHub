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
        primary: '#006ecf', 
        darkBg: '#121212', 
        darkCard: '#1E1E1E'
      }
    },
  },
  plugins: [],
}