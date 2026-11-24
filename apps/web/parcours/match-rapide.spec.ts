// Parcours de la tranche 1, joués dans le navigateur : choisir une franchise → voir l'effectif → simuler un match rapide
// dans le Web Worker → lire le box score. Le box score du navigateur doit être celui des tests Node (même empreinte).
import { expect, test } from '@playwright/test';

/** Empreinte du match de référence (packages/engine/tests/match.test.ts, docs/SIMULATION_MATCH.md § 5). */
const EMPREINTE_REFERENCE = 'a87497bc0d7ba6d3';

test('choisir une franchise affiche son effectif noté', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Basket Legends' })).toBeVisible();
  await expect(page.locator('ul.franchises > li')).toHaveCount(30);

  await page.getByRole('button', { name: /Boston Beacons/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Boston Beacons' })).toBeVisible();
  const lignes = page.getByRole('region', { name: 'Effectif' }).locator('tbody tr');
  await expect(lignes.first()).toBeVisible();
  await expect(lignes.filter({ hasText: 'Titulaire' })).toHaveCount(5);
  await expect(page.getByText(/Notes du modèle v1/)).toBeVisible();
});

test('le match de référence donne dans le navigateur la même empreinte que dans Node', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Boston Beacons/ }).click();
  await page.getByLabel('Adversaire').selectOption({ label: 'New York Skyliners' });
  await page.getByLabel('À domicile').check();
  await page.getByLabel('Graine').fill('2026');
  await page.getByRole('button', { name: 'Jouer le match' }).click();

  await expect(page.getByRole('region', { name: 'Score par période' })).toBeVisible();
  await expect(page.locator('code')).toHaveText(EMPREINTE_REFERENCE);

  // Rejouer avec la même graine redonne le même match.
  await page.getByRole('button', { name: 'Rejouer avec la même graine' }).click();
  await expect(page.locator('code')).toHaveText(EMPREINTE_REFERENCE);

  // Retour à l'effectif : la demande est conservée.
  await page.getByRole('button', { name: "Retour à l'effectif" }).click();
  await expect(page.getByLabel('Graine')).toHaveValue('2026');
});

test('changer de lieu change le match, pas sa cohérence', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Boston Beacons/ }).click();
  await page.getByLabel('Adversaire').selectOption({ label: 'New York Skyliners' });
  await page.getByLabel("À l'extérieur").check();
  await page.getByLabel('Graine').fill('2026');
  await page.getByRole('button', { name: 'Jouer le match' }).click();
  await expect(page.locator('code')).toHaveText(/^[0-9a-f]{16}$/);
  await expect(page.locator('code')).not.toHaveText(EMPREINTE_REFERENCE);
});
