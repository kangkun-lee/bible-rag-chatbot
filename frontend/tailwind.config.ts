import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class', // 클래스 기반 다크모드
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // shadcn/ui 호환 변수
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: 'hsl(var(--card))',
        'card-foreground': 'hsl(var(--card-foreground))',
        popover: 'hsl(var(--popover))',
        'popover-foreground': 'hsl(var(--popover-foreground))',
        primary: 'hsl(var(--primary))',
        'primary-foreground': 'hsl(var(--primary-foreground))',
        secondary: 'hsl(var(--secondary))',
        'secondary-foreground': 'hsl(var(--secondary-foreground))',
        muted: 'hsl(var(--muted))',
        'muted-foreground': 'hsl(var(--muted-foreground))',
        accent: 'hsl(var(--accent))',
        'accent-foreground': 'hsl(var(--accent-foreground))',
        destructive: 'hsl(var(--destructive))',
        'destructive-foreground': 'hsl(var(--destructive-foreground))',
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        success: 'hsl(var(--success))',
        warning: 'hsl(var(--warning))',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontSize: {
        // Fluid 타이포그래피 (Utopia 스타일)
        'fluid-xs': 'clamp(0.75rem, 0.7rem + 0.2vw, 0.875rem)',
        'fluid-sm': 'clamp(0.875rem, 0.8rem + 0.3vw, 1rem)',
        'fluid-base': 'clamp(0.95rem, 0.9rem + 0.28vw, 1.05rem)',
        'fluid-lg': 'clamp(1.125rem, 1rem + 0.5vw, 1.25rem)',
        'fluid-xl': 'clamp(1.25rem, 1.1rem + 0.7vw, 1.5rem)',
        'fluid-2xl': 'clamp(1.5rem, 1.2rem + 1.2vw, 2rem)',
        'fluid-3xl': 'clamp(2rem, 1.5rem + 2vw, 3rem)',
        'fluid-4xl': 'clamp(2.5rem, 2rem + 3vw, 4rem)',
      },
      lineHeight: {
        'fluid-tight': '1.2',
        'fluid-snug': '1.4',
        'fluid-normal': '1.6',
        'fluid-relaxed': '1.75',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 3s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}

export default config

