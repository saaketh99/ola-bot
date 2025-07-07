module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./pages/**/*.{js,jsx,ts,tsx}",
    "./styles/**/*.{css,scss}",
  ],
  theme: {
    extend: {
      colors: {
        border: '#e5e7eb', // Tailwind's default border color
        background: '#ffffff', // Default background color
        foreground: '#18181b', // Default foreground color
      },
    },
  },
  plugins: [],
} 