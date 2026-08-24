/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Paleta base de Domio — ajustar cuando el brand book este listo.
        domio: {
          bg: "#0F1220",
          card: "#1B1F33",
          primary: "#F5B942", // acento calido (XP, progreso)
          secondary: "#5AD1B3", // acento fresco (exito, retos)
          danger: "#E8615A", // misiones incumplidas
          muted: "#7A7F9A",
        },
      },
    },
  },
  plugins: [],
};
