import { expect, test } from '@playwright/test';
import { checkMobile, snap } from './helpers';

test('create a deck, add cards, review them, see progress', async ({ page }) => {
  await page.goto('./');
  await page.getByRole('button', { name: /Question: el gato/ }).click();
  await page.waitForTimeout(1000);
  await snap(page, 'landing');
  await checkMobile(page, 'landing-mobile');
  await page.getByRole('link', { name: 'Start reviewing' }).first().click();
  await page.getByLabel('Deck name').fill('Chemistry symbols');
  await page.getByRole('button', { name: 'Create deck' }).click();
  await page.getByRole('link', { name: 'Chemistry symbols' }).click();
  await page.getByText('Import many cards', { exact: true }).click();
  await page.getByLabel('Cards to import').fill('Na\tSodium\nFe\tIron\nAu\tGold');
  await page.getByRole('button', { name: 'Import' }).click();
  await expect(page.getByText(/Imported 3 cards/)).toBeVisible();
  await page.getByRole('link', { name: 'Review 3 due' }).click();

  await expect(page.getByTestId('review-pos')).toHaveText('1 / 3');
  await page.getByRole('button', { name: /Show answer/ }).click();
  await page.waitForTimeout(700);
  await snap(page, 'review');
  await checkMobile(page);
  await page.getByRole('button', { name: /Got it right/ }).click();
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Space');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('2 of 3 right');
  await page.reload();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Progress' }).click();
  await expect(page.getByRole('img', { name: /Reviews over the last 14 days/ })).toBeVisible();
  await snap(page, 'progress');
});
