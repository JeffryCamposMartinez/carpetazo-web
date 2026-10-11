import { defineConfig, devices } from '@playwright/test';

// Pruebas de navegador de los flujos críticos (sin iniciar sesión). Por defecto prueban el sitio en producción:
//   BASE_URL=http://localhost:5173 npx playwright test        (contra el sitio local)
//   E2E_CHANNEL=msedge npx playwright test                    (usa el Edge instalado en vez de descargar Chromium)
export default defineConfig({
  testDir: './e2e',
  timeout: 45000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  use: {
    baseURL: process.env.BASE_URL || 'https://carpetazo.cl',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...(process.env.E2E_CHANNEL ? { channel: process.env.E2E_CHANNEL } : {}),
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 }, ...(process.env.E2E_CHANNEL ? { channel: process.env.E2E_CHANNEL } : {}) } },
    { name: 'celular', use: { ...devices['Pixel 7'], ...(process.env.E2E_CHANNEL ? { channel: process.env.E2E_CHANNEL } : {}) } },
  ],
});
