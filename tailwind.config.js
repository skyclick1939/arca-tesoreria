/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Verdes (México)
        'primary': '#006847',        // Verde oscuro principal
        'primary-light': '#4CAF50',  // Verde Material (acentos/gráficas)
        'primary-accent': '#103C10', // Verde muy oscuro (fondos íconos)

        // Rojos (México)
        'danger': '#CE1126',         // Rojo principal
        'danger-light': '#F44336',   // Rojo Material (acentos)

        // Fondos dark mode
        'background-dark': '#121212', // Fondo principal
        'surface-dark': '#1E1E1E',   // Cards y superficies elevadas
        'card-dark': '#1E1E1E',      // Alias para cards

        // Textos
        'text-primary': '#FFFFFF',   // Texto principal
        'text-secondary': '#A0A0A0', // Texto secundario/hints
        'text-muted': '#9db89d',     // Texto deshabilitado

        // Bordes
        'border-dark': '#333333',    // Bordes y divisores
      }
    }
  },
  plugins: [],
}

