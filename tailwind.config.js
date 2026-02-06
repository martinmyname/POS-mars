/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'tufts-blue': '#2563eb',
        'tufts-blue-hover': '#1d4ed8',
        'smoky-black': '#0f172a',
        'background-grey': '#f1f5f9',
        'brand-white': '#ffffff',
        surface: '#ffffff',
        'surface-hover': '#f8fafc',
      },
      fontFamily: {
        heading: ['DM Sans', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.06)',
        soft: '0 2px 8px rgb(0 0 0 / 0.06)',
        'bottom-nav': '0 -2px 10px rgb(0 0 0 / 0.08)',
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
      },
      spacing: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
        'touch': '2.75rem', // ~44px min touch target
      },
      minHeight: {
        touch: '2.75rem',
      },
      maxWidth: {
        'app': '90rem',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
