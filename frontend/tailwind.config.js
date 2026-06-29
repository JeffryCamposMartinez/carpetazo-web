/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      "colors": {
          "surface-container-highest": "#285896",
          "on-primary-container": "#fffbff",
          "on-primary-fixed-variant": "#4d3d00",
          "on-secondary-fixed": "#e0e7ff",
          "primary-container": "#ffcb05",
          "error": "#ef4444",
          "tertiary": "#00d2ff",
          "secondary-container": "#3b82f6",
          "on-secondary-container": "#eff6ff",
          "tertiary-container": "#0284c7",
          "on-primary-fixed": "#1a1400",
          "on-background": "#f8fafc",
          "primary-fixed": "#ffe58a",
          "outline": "#64748b",
          "primary": "#ffcb05",
          "surface-dim": "#0f2342",
          "on-tertiary-container": "#cffafe",
          "tertiary-fixed-dim": "#67e8f9",
          "secondary-fixed-dim": "#93c5fd",
          "background": "#071526",
          "on-secondary-fixed-variant": "#2563eb",
          "on-tertiary-fixed-variant": "#0891b2",
          "surface-container-high": "#20487d",
          "primary-fixed-dim": "#fcd34d",
          "on-tertiary-fixed": "#083344",
          "secondary": "#60a5fa",
          "outline-variant": "#475569",
          "tertiary-fixed": "#cffafe",
          "surface-container": "#1a3b68",
          "inverse-on-surface": "#1a3b68",
          "on-surface": "#f1f5f9",
          "on-error": "#ffffff",
          "on-primary": "#000000",
          "surface-tint": "#ffcb05",
          "inverse-surface": "#f8fafc",
          "surface-variant": "#20487d",
          "error-container": "#7f1d1d",
          "on-secondary": "#ffffff",
          "secondary-fixed": "#bfdbfe",
          "surface-container-low": "#142e55",
          "on-surface-variant": "#cbd5e1",
          "inverse-primary": "#b45309",
          "surface-bright": "#285896",
          "surface": "#11274a",
          "on-tertiary": "#000000",
          "on-error-container": "#fca5a5",
          "surface-container-lowest": "#0d1e3a"
      },
      "borderRadius": {
          "DEFAULT": "0.25rem",
          "lg": "0.5rem",
          "xl": "0.75rem",
          "full": "9999px"
      },
      "spacing": {
          "container-max": "1280px",
          "gutter": "16px",
          "md": "16px",
          "sm": "8px",
          "2xl": "48px",
          "xl": "32px",
          "base": "4px",
          "xs": "4px",
          "lg": "24px"
      },
      "fontFamily": {
          "body-md": ["Plus Jakarta Sans", "sans-serif"],
          "display-lg": ["Plus Jakarta Sans", "sans-serif"],
          "headline-lg-mobile": ["Plus Jakarta Sans", "sans-serif"],
          "headline-md": ["Plus Jakarta Sans", "sans-serif"],
          "body-lg": ["Plus Jakarta Sans", "sans-serif"],
          "label-md": ["Work Sans", "sans-serif"],
          "label-sm": ["Work Sans", "sans-serif"],
          "headline-lg": ["Plus Jakarta Sans", "sans-serif"]
      },
      "fontSize": {
          "body-md": ["16px", { "lineHeight": "24px", "fontWeight": "400" }],
          "display-lg": ["48px", { "lineHeight": "56px", "letterSpacing": "-0.02em", "fontWeight": "800" }],
          "headline-lg-mobile": ["24px", { "lineHeight": "32px", "fontWeight": "700" }],
          "headline-md": ["20px", { "lineHeight": "28px", "fontWeight": "700" }],
          "body-lg": ["18px", { "lineHeight": "28px", "fontWeight": "400" }],
          "label-md": ["14px", { "lineHeight": "20px", "letterSpacing": "0.02em", "fontWeight": "600" }],
          "label-sm": ["12px", { "lineHeight": "16px", "fontWeight": "700" }],
          "headline-lg": ["32px", { "lineHeight": "40px", "letterSpacing": "-0.01em", "fontWeight": "700" }]
      },
      "keyframes": {
        "fadeIn": {
          "0%": { opacity: 0, transform: 'translateY(10px)' },
          "100%": { opacity: 1, transform: 'translateY(0)' }
        },
        "marquee": {
          "0%": { transform: 'translateX(0%)' },
          "100%": { transform: 'translateX(-50%)' }
        },
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-15px)" }
        }
      },
      "animation": {
        "fadeIn": "fadeIn 0.5s ease-out forwards",
        "marquee": "marquee 40s linear infinite",
        "float": "float 6s ease-in-out infinite"
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/container-queries')
  ],
}
