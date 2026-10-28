/** @type {import('tailwindcss').Config} */
export default {
  // hover só onde existe mouse: no toque o :hover "gruda" depois do tap
  future: { hoverOnlyWhenSupported: true },
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Paleta InvestPortal (tema escuro, navy + dourado) ──────────────
        ip: {
          bg: '#070b12',          // fundo da página
          'bg-soft': '#0a1018',
          surface: '#0d141f',     // cards
          'surface-2': '#131d2b', // elevado / hover / inputs
          'surface-3': '#1a2637',
          border: '#1f2b3d',
          'border-soft': '#18222f',
          navy: '#0A2540',        // navy da marca (logo)
          'navy-500': '#123a5e',
          'navy-400': '#2f6aa8',
          sky: '#4d9de0',
          gold: '#F0C040',        // acento principal
          'gold-600': '#d9a833',
          'gold-700': '#b78a24',
          text: '#eef2f8',
          'text-dim': '#93a1b5',
          'text-mute': '#5c6b81',
          positive: '#37d399',
          'positive-dim': '#0f3a2e',
          negative: '#fb7185',
          'negative-dim': '#3d1a24',
        },
        // aliases legados (mantidos p/ compatibilidade)
        primary: '#0A2540',
        secondary: '#F0C040',
        neutral: '#F5F5F5',
        text: '#333333',
      },
      // tracking por tamanho (skill apple-design): negativo cresce com o texto, ~0 no pequeno
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem', letterSpacing: '0' }],
        sm: ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '-0.006em' }],
        base: ['1rem', { lineHeight: '1.5rem', letterSpacing: '-0.011em' }],
        lg: ['1.125rem', { lineHeight: '1.75rem', letterSpacing: '-0.014em' }],
        xl: ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '-0.017em' }],
        '2xl': ['1.5rem', { lineHeight: '2rem', letterSpacing: '-0.019em' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.021em' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '-0.022em' }],
      },
      fontFamily: {
        sans: [
          'Inter',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.375rem',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.4), 0 12px 32px -12px rgba(0,0,0,0.55)',
        'card-hover':
          '0 1px 2px rgba(0,0,0,0.4), 0 20px 48px -16px rgba(0,0,0,0.65)',
        glow: '0 0 0 1px rgba(240,192,64,0.35), 0 10px 40px -8px rgba(240,192,64,0.25)',
      },
      backgroundImage: {
        'ip-radial':
          'radial-gradient(120% 120% at 100% 0%, rgba(28,79,124,0.22) 0%, rgba(7,11,18,0) 55%)',
        'gold-sheen':
          'linear-gradient(135deg, #F0C040 0%, #f6d072 50%, #d9a833 100%)',
      },
      animation: {
        marquee: 'marquee 32s linear infinite',
        'fade-up': 'fade-up 0.5s cubic-bezier(0.22, 1, 0.36, 1) both',
        'fade-in': 'fade-in 0.4s ease-out both',
        shimmer: 'shimmer 1.6s linear infinite',
        'pulse-soft': 'pulse-soft 2.4s ease-in-out infinite',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
      },
    },
  },
  plugins: [],
};
