const { setWorldConstructor, setDefaultTimeout } = require('@cucumber/cucumber');
const { chromium } = require('playwright');

setDefaultTimeout(60000);

// Configuration
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:8080';
const DOCUMENT_BASE_BACKEND_URL = process.env.DOCUMENT_BASE_BACKEND_URL || 'http://localhost:8082';
const DOCUMENT_BASE_FRONTEND_URL = process.env.DOCUMENT_BASE_FRONTEND_URL || 'http://localhost:3001';
const DOCUMENT_BASE_CLIENT_ID = 'document-base-clientid';

class CustomWorld {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  async ensureBrowser() {
    if (this.browser) return;

    this.browser = await chromium.launch({
      headless: false,
      slowMo: 300,
      channel: 'chrome'
    });
    this.context = await this.browser.newContext();
    this.page = await this.context.newPage();

    // Auto-accept dialogs (window.confirm, window.alert)
    this.page.on('dialog', async dialog => {
      console.log(`  [DIALOG ${dialog.type()}]: ${dialog.message()}`);
      await dialog.accept();
    });

    // Logging
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`  [BROWSER ${msg.type()}]: ${msg.text()}`);
      }
    });
    this.page.on('pageerror', error => {
      console.log(`  [PAGE ERROR]: ${error.message}`);
    });
    this.page.on('requestfailed', request => {
      if (request.failure()?.errorText === 'net::ERR_ABORTED') return;
      console.log(`  [REQUEST FAILED]: ${request.url()} - ${request.failure()?.errorText}`);
    });
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
    }
  }

  async performLogin(username, password) {
    // Close and reopen browser to ensure clean session (no stale SSO cookies)
    await this.closeBrowser();
    await this.ensureBrowser();

    await this.page.goto(DOCUMENT_BASE_FRONTEND_URL);
    await this.page.waitForURL(/localhost:3000\/login/, { timeout: 20000 });

    await this.page.waitForSelector('input[type="text"], input[name="username"]', { timeout: 10000 });
    await this.page.fill('input[type="text"], input[name="username"]', username);
    await this.page.fill('input[type="password"], input[name="password"]', password);
    await this.page.click('button[type="submit"]');

    await this.page.waitForURL(/localhost:3001/, { timeout: 30000 });
    await this.page.waitForURL(url => {
      const s = url.toString();
      return s.includes('localhost:3001') && !s.includes('/auth/callback');
    }, { timeout: 15000 });

    await this.page.waitForSelector('.dashboard-header, .dashboard-container', { timeout: 20000 });
  }
}

// Export config for use in step files
CustomWorld.AUTH_SERVICE_URL = AUTH_SERVICE_URL;
CustomWorld.DOCUMENT_BASE_BACKEND_URL = DOCUMENT_BASE_BACKEND_URL;
CustomWorld.DOCUMENT_BASE_FRONTEND_URL = DOCUMENT_BASE_FRONTEND_URL;
CustomWorld.DOCUMENT_BASE_CLIENT_ID = DOCUMENT_BASE_CLIENT_ID;

setWorldConstructor(CustomWorld);

module.exports = { CustomWorld };
