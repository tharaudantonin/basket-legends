// Parcours des tranches 1 et 3, joués dans le navigateur : choisir une franchise → voir l'effectif → simuler un match
// dans le Web Worker → lire le box score. Le box score du navigateur doit être celui des tests Node (même empreinte).
import { expect, test } from '@playwright/test';

/** Empreinte du match de référence (packages/engine/tests/match.test.ts, docs/SIMULATION_MATCH.md § 5). */
const EMPREINTE_REFERENCE = 'f69b9934b578d77d';

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

test('le mode commenté raconte le même match que le mode rapide', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Boston Beacons/ }).click();
  await page.getByLabel('Adversaire').selectOption({ label: 'New York Skyliners' });
  await page.getByLabel('À domicile').check();
  await page.getByLabel('Graine').fill('2026');
  await page.getByRole('button', { name: 'Match commenté' }).click();

  const fil = page.getByRole('region', { name: 'Commentaire' });
  await expect(fil.locator('li').first()).toBeVisible();
  await page.getByRole('button', { name: 'Aller à la fin' }).click();
  await expect(fil.locator('li').first()).toContainText('Fin du match');
  await expect(page.getByRole('status').filter({ hasText: 'Terminé' })).toBeVisible();

  await page.getByRole('button', { name: 'Voir le box score' }).click();
  await expect(page.locator('code')).toHaveText(EMPREINTE_REFERENCE);
  await expect(page.getByRole('heading', { name: 'Moments du match' })).toBeVisible();
});

test("la fiche d'un joueur montre ses notes, ses statistiques sourcées et son graphique d'adresse", async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Boston Beacons/ }).click();
  await page.getByLabel('Adversaire').selectOption({ label: 'New York Skyliners' });
  await page.getByLabel('Graine').fill('2026');
  await page.getByRole('button', { name: 'Jouer le match' }).click();

  // Le meilleur marqueur du match (premier titulaire listé de l'équipe qui reçoit).
  const tableau = page.getByRole('region', { name: 'Statistiques Boston Beacons' });
  const premier = tableau.locator('tbody th button').first();
  const nom = (await premier.textContent())!.trim();
  await premier.click();
  await expect(page.getByRole('heading', { level: 1, name: nom })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Notes' })).toBeVisible();
  await expect(page.getByRole('img', { name: /Graphique d'adresse/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Statistiques réelles de référence' })).toBeVisible();
  await expect(page.getByText('Chargement…')).toHaveCount(0);

  await page.getByRole('button', { name: '← Retour' }).click();
  await expect(page.locator('code')).toHaveText(EMPREINTE_REFERENCE);
});
