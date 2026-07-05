/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: '#09090b',       // Deep Apple dark
          card: '#18181b',       // Dark zinc card background
          border: '#27272a',     // Subtle dark border
          accent: '#f97316',     // Soft Orange accent
          accentHover: '#ea580c',// Accent hover
          textPrimary: '#f4f4f5',// Near white
          textSecondary: '#a1a1aa', // Gray
          beige: '#fcfaf7',      // Warm light mode background
          charcoal: '#1c1c1e',   // Stripe-like dark grey
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
