import {test, expect, _electron as electron} from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';

test('platform shortcuts, localized help, save and undo/redo', async () => {
  const root = process.cwd();
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'openpdf-shortcuts-'));
  const app = await electron.launch({args: [root, '--user-data-dir=' + path.join(temp, 'profile')]});
  try {
    const page = await app.firstWindow();
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.locator('.empty').waitFor();
    await page.evaluate(() => localStorage.setItem('language', 'en-US'));
    await page.reload();
    await expect(page).toHaveTitle('OpenPDF Studio');
    expect(await page.evaluate(() => window.studio.platform)).toBe(process.platform);
    const mac = process.platform === 'darwin';
    await expect(page.locator('.quick-actions').getByRole('button', {name: 'Open PDF', exact: true})).toHaveAttribute('title', 'Open PDF · ' + (mac ? '⌘O' : 'Ctrl+O'));
    await page.getByRole('button', {name: 'Help', exact: true}).click();
    await expect(page.locator('dialog')).toContainText(mac ? '⌘S' : 'Ctrl+S');
    await expect(page.locator('dialog')).not.toContainText('{{');
    await page.locator('dialog').getByRole('button', {name: 'Close', exact: true}).click();
    const nativeMenus = await app.evaluate(({Menu}) => Menu.getApplicationMenu()!.items.map(item => item.label));
    expect(nativeMenus[0]).toBe(mac ? 'OpenPDF Studio' : 'File');
    await app.evaluate(({dialog}, file) => { dialog.showOpenDialog = async () => ({canceled: false, filePaths: [file]}); }, path.join(root, 'test-fixtures/research.pdf'));
    await page.keyboard.press(mac ? 'Meta+o' : 'Control+o');
    await page.locator('.paper>img').waitFor();
    await page.locator('.ribbon').getByRole('button', {name: 'Rotate page', exact: true}).click();
    const undo = page.getByRole('button', {name: 'Undo', exact: true});
    const redo = page.getByRole('button', {name: 'Redo', exact: true});
    await expect(undo).toBeEnabled();
    await page.keyboard.press(mac ? 'Meta+z' : 'Control+z');
    await expect(redo).toBeEnabled();
    await expect(undo).toBeDisabled();
    await page.keyboard.press(mac ? 'Meta+Shift+z' : 'Control+y');
    await expect(undo).toBeEnabled();
    await expect(redo).toBeDisabled();
    const output = path.join(temp, '合同 已编辑.pdf');
    await app.evaluate(({dialog}, file) => { dialog.showSaveDialog = async () => ({canceled: false, filePath: file}); }, output);
    await page.keyboard.press(mac ? 'Meta+s' : 'Control+s');
    await expect.poll(async () => (await fs.stat(output).catch(() => null))?.size || 0).toBeGreaterThan(100);
    await expect(page.locator('.dirty-dot')).toHaveCount(0);
    await expect(page.locator('vite-error-overlay')).toHaveCount(0);
    expect(errors).toEqual([]);
    const evidence = process.env.OPENPDF_EVIDENCE || path.join(os.tmpdir(), 'openpdf-evidence');
    await fs.mkdir(evidence, {recursive: true});
    await page.screenshot({path: path.join(evidence, `shortcuts-${process.platform}.png`)});
  } finally {
    await app.close();
    await fs.rm(temp, {recursive: true, force: true, maxRetries: 5, retryDelay: 500});
  }
});
