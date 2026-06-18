import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test',

  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }]
  ],

  use: {
    baseURL: 'http://localhost:3000',
    headless: false,

    launchOptions: {
      executablePath: '/usr/bin/google-chrome',
      args: ['--no-sandbox']
    },

    screenshot: 'only-on-failure'
  }
});