const { Given, When, Then, After } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');
const { CustomWorld } = require('./world');

const AUTH_SERVICE_URL = CustomWorld.AUTH_SERVICE_URL;
const DOCUMENT_BASE_BACKEND_URL = CustomWorld.DOCUMENT_BASE_BACKEND_URL;
const DOCUMENT_BASE_FRONTEND_URL = CustomWorld.DOCUMENT_BASE_FRONTEND_URL;
const DOCUMENT_BASE_CLIENT_ID = CustomWorld.DOCUMENT_BASE_CLIENT_ID;

// Cleanup after each scenario
After(async function () {
  await this.closeBrowser();
});

// =============================================
// Background steps
// =============================================

Given('the auth service is running on port 8080', async function () {
  const response = await fetch(`${AUTH_SERVICE_URL}/health`);
  expect(response.status).toBe(200);
  console.log('  Auth service is running');
});

Given('the document base backend is running on port 8082', async function () {
  const response = await fetch(`${DOCUMENT_BASE_BACKEND_URL}/health`);
  const data = await response.json();
  expect(response.status).toBe(200);
  expect(data.status).toBe('ok');
  console.log('  Document Base backend is running');
});

Given('the document base frontend is running on port 3001', async function () {
  const response = await fetch(DOCUMENT_BASE_FRONTEND_URL);
  expect(response.status).toBe(200);
  console.log('  Document Base frontend is running');
});

// =============================================
// Redirect scenario steps
// =============================================

Given('I open the Document Base application', async function () {
  await this.ensureBrowser();
  await this.page.goto(DOCUMENT_BASE_FRONTEND_URL);
  console.log('  Opened Document Base at', DOCUMENT_BASE_FRONTEND_URL);
});

Then('I should be redirected to the auth service login page', async function () {
  await this.page.waitForURL(/localhost:3000\/login/, { timeout: 20000 });
  const url = this.page.url();
  console.log('  Redirected to:', url);
  expect(url).toContain('localhost:3000/login');
});

Then('the redirect URL should contain the document-base client_id', async function () {
  const url = this.page.url();
  expect(url).toContain(DOCUMENT_BASE_CLIENT_ID);
  console.log('  URL contains client_id:', DOCUMENT_BASE_CLIENT_ID);
});

Then('the redirect URL should contain a redirect_uri back to document base', async function () {
  const url = this.page.url();
  expect(url).toContain('redirect_uri=http://localhost:3001');
  console.log('  URL contains redirect_uri to document base');
});

Given('I am redirected to the auth service login page', async function () {
  await this.page.waitForURL(/localhost:3000\/login/, { timeout: 20000 });
  await this.page.waitForSelector('input[type="text"], input[name="username"]', { timeout: 10000 });
  console.log('  On auth service login page');
});

// =============================================
// Login steps
// =============================================

When('I enter username {string} and password {string}', async function (username, password) {
  await this.page.fill('input[type="text"], input[name="username"]', username);
  await this.page.fill('input[type="password"], input[name="password"]', password);
  console.log(`  Entered credentials: ${username}`);
});

When('I click the login button', async function () {
  await this.page.click('button[type="submit"]');
  console.log('  Clicked login button');
});

Then('I should be redirected back to Document Base', async function () {
  await this.page.waitForURL(/localhost:3001/, { timeout: 30000 });
  const url = this.page.url();
  expect(url).toContain('localhost:3001');
  console.log('  Redirected back to Document Base:', url);
});

Then('the Document Base dashboard should load', async function () {
  await this.page.waitForURL(url => {
    const s = url.toString();
    return s.includes('localhost:3001') && !s.includes('/auth/callback');
  }, { timeout: 15000 });
  await this.page.waitForSelector('.dashboard-header, .dashboard-container', { timeout: 15000 });
  console.log('  Dashboard loaded');
});

Then('I should see {string} in the header', async function (text) {
  await this.page.waitForSelector('.dashboard-header', { timeout: 10000 });
  const header = await this.page.textContent('.dashboard-header');
  expect(header).toContain(text);
  console.log(`  Header contains "${text}"`);
});

Then('I should see the user dropdown with username {string}', async function (username) {
  await this.page.waitForSelector('.user-dropdown-toggle', { timeout: 10000 });
  const userDropdown = await this.page.textContent('.user-dropdown-toggle');
  expect(userDropdown).toContain(username);
  console.log(`  User dropdown shows "${username}"`);
});

Then('the URL should be the Document Base root URL', async function () {
  await this.page.waitForURL(url => {
    const s = url.toString();
    return s.includes('localhost:3001') && !s.includes('/auth/callback');
  }, { timeout: 15000 });
  const url = this.page.url();
  expect(url).toMatch(/localhost:3001\/?$/);
  console.log('  URL is Document Base root');
});

// =============================================
// Authenticated user steps (shortcut login)
// =============================================

Given('I am logged into Document Base as {string} with password {string}', async function (username, password) {
  await this.performLogin(username, password);
  console.log(`  Logged in as ${username}`);
});

// =============================================
// Tab visibility steps (permission-based)
// =============================================

Then('I should see the {string} tab', async function (tabName) {
  await this.page.waitForSelector('.tabs', { timeout: 10000 });
  const tabButton = await this.page.$$eval('.tabs button', (buttons, name) => {
    return buttons.some(btn => btn.textContent.trim() === name);
  }, tabName);
  expect(tabButton).toBe(true);
  console.log(`  Tab "${tabName}" is visible`);
});

Then('I should not see the {string} tab', async function (tabName) {
  await this.page.waitForSelector('.tabs', { timeout: 10000 });
  const tabButton = await this.page.$$eval('.tabs button', (buttons, name) => {
    return buttons.some(btn => btn.textContent.trim() === name);
  }, tabName);
  expect(tabButton).toBe(false);
  console.log(`  Tab "${tabName}" is correctly hidden`);
});

// =============================================
// Logout steps
// =============================================

When('I open the user dropdown menu', async function () {
  await this.page.click('.user-dropdown-toggle');
  await this.page.waitForSelector('.user-dropdown-menu', { timeout: 5000 });
  console.log('  User dropdown menu opened');
});

When('I click the logout button', async function () {
  await this.page.click('.dropdown-logout');
  console.log('  Clicked logout');
});
