/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        petrol: {
          900: '#13354B',
          800: '#1A4B69',
          700: '#1E5676',
          600: '#266A91',
        },
        navy: {
          950: '#071826',
          900: '#0A2540',
          850: '#0C2D48',
          800: '#103859',
          700: '#164368',
        },
        surface: {
          canvas: '#F4F7FB',
          card: '#FFFFFF',
          border: '#E8EEF5',
          muted: '#F8FAFC',
        },
        amber: {
          450: '#F59E0B',
          500: '#EAB308',
        },
        brand: {
          50: '#F0F9FF',
          100: '#E0F2FE',
          500: '#0284C7',
          600: '#0369A1',
          700: '#075985',
        },
      },
      boxShadow: {
        'card': '0 2px 12px -2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.02)',
        'card-hover': '0 8px 24px -4px rgba(15, 23, 42, 0.08), 0 2px 6px rgba(15, 23, 42, 0.04)',
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
      }
    },
  },
  plugins: [],
}
