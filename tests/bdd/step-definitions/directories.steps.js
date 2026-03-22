const { When, Then } = require('@cucumber/cucumber');
const { expect } = require('@playwright/test');

// =============================================
// Tab navigation
// =============================================

When('I navigate to the {string} tab', async function (tabName) {
  await this.page.waitForSelector('.tabs', { timeout: 10000 });
  await this.page.click(`.tabs button:text-is("${tabName}")`);
  await this.page.waitForTimeout(500);
  console.log(`  Navigated to "${tabName}" tab`);
});

// =============================================
// Directory creation steps
// =============================================

When('I enter {string} as the new directory name', async function (name) {
  await this.page.waitForSelector('.create-dir-form', { timeout: 10000 });
  await this.page.fill('.create-dir-form input[type="text"]', name);
  console.log(`  Entered directory name: ${name}`);
});

When('I select {string} as the parent directory', async function (parentName) {
  await this.page.waitForSelector('.create-dir-form select', { timeout: 5000 });
  const optionValue = await this.page.$eval('.create-dir-form select', (select, name) => {
    const options = Array.from(select.querySelectorAll('option'));
    const match = options.find(opt => opt.textContent.includes(name));
    return match ? match.value : null;
  }, parentName);

  if (optionValue) {
    await this.page.selectOption('.create-dir-form select', optionValue);
    console.log(`  Selected parent directory: ${parentName}`);
  } else {
    throw new Error(`Parent directory "${parentName}" not found in select`);
  }
});

When('I click the {string} button in the directory form', async function (buttonText) {
  await this.page.click('.create-dir-form button[type="submit"]');
  await this.page.waitForTimeout(1000);
  console.log(`  Clicked "${buttonText}" button`);
});

// =============================================
// Directory tree assertions
// =============================================

Then('I should see a directory named {string} in the tree', async function (name) {
  await this.page.waitForSelector('.dir-tree', { timeout: 10000 });
  await this.page.waitForSelector(`.dir-name:text-is("${name}")`, { timeout: 5000 });
  console.log(`  Directory "${name}" found in tree`);
});

Then('I should not see a directory named {string} in the tree', async function (name) {
  await this.page.waitForSelector('.dir-tree, .empty-text', { timeout: 10000 });
  await this.page.waitForTimeout(500);
  const found = await this.page.$$(`.dir-name:text-is("${name}")`);
  expect(found.length).toBe(0);
  console.log(`  Directory "${name}" not in tree (correct)`);
});

Then('I should see a success message containing {string}', async function (text) {
  await this.page.waitForSelector('.success-message', { timeout: 5000 });
  const message = await this.page.textContent('.success-message');
  expect(message.toLowerCase()).toContain(text.toLowerCase());
  console.log(`  Success message: ${message}`);
});

// =============================================
// Directory expand steps
// =============================================

When('I expand directory {string}', async function (dirName) {
  const dirRow = this.page.locator('.dir-row', { has: this.page.locator(`.dir-name:text-is("${dirName}")`) });
  await dirRow.waitFor({ timeout: 5000 });
  await dirRow.locator('.expand-btn').click();
  await this.page.waitForTimeout(300);
  console.log(`  Expanded directory "${dirName}"`);
});

// =============================================
// Directory rename steps
// =============================================

When('I click the {string} button on directory {string}', async function (action, dirName) {
  const dirRow = this.page.locator('.dir-row', { has: this.page.locator(`.dir-name:text-is("${dirName}")`) });
  await dirRow.waitFor({ timeout: 5000 });

  if (action === 'Rename') {
    await dirRow.locator('.action-btn.edit').click();
  } else if (action === 'Delete') {
    await dirRow.locator('.action-btn.delete').click();
  } else if (action === '+ Child') {
    await dirRow.locator('.action-btn.create-child').click();
  }

  await this.page.waitForTimeout(300);
  console.log(`  Clicked "${action}" on directory "${dirName}"`);
});

When('I change the directory name to {string}', async function (newName) {
  await this.page.waitForSelector('.edit-inline input', { timeout: 5000 });
  await this.page.fill('.edit-inline input', newName);
  console.log(`  Changed directory name to: ${newName}`);
});

When('I click the inline {string} button', async function (buttonText) {
  await this.page.click('.edit-inline .action-btn.save');
  await this.page.waitForTimeout(1000);
  console.log(`  Clicked inline "${buttonText}" button`);
});

// =============================================
// Delete confirmation (handled by dialog auto-accept in world.js)
// =============================================

When('I confirm the deletion', async function () {
  // Dialog is auto-accepted by page.on('dialog') in world.js
  await this.page.waitForTimeout(500);
  console.log('  Confirmed deletion');
});
