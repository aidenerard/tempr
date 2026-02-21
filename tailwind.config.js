/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#1DB954",
        secondary: "#191414",
        accent: "#1ED760",
        background: "#121212",
        surface: "#181818",
        "text-muted": "#B3B3B3",
      },
    },
  },
  plugins: [],
};
