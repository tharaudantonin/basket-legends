// Parcours testés avec Playwright (tranche 2, décision du 24/11/2026) : le jeu réel, dans un vrai navigateur.
// En local, on utilise le Chrome installé (pas de téléchargement de navigateur) ; l'intégration continue installe
// Chromium (`npx playwright install --with-deps chromium`).
import { defineConfig } from '@playwright/test';

const CI = Boolean(process.env.CI);

export default defineConfig({
  testDir: 'apps/web/parcours',
  timeout: 30_000,
  forbidOnly: CI,
  retries: 0,
  reporter: CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:5180',
    ...(CI ? {} : { channel: 'chrome' }),
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5180',
    reuseExistingServer: !CI,
    timeout: 60_000,
  },
});
