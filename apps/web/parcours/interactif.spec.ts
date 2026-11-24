// Parcours de la tranche 5 : le mode interactif. Sans décision, c'est le match de référence ; avec des décisions, le
// match change, et les mêmes décisions redonnent le même match. En saison, un match interactif interrompu se reprend
// après rechargement de la page, puis la saison enregistre ce match.
import { expect, test, type Page } from '@playwright/test';

/** Empreinte du match de référence (packages/engine/tests/match.test.ts, docs/SIMULATION_MATCH.md § 5). */
const EMPREINTE_REFERENCE = '0a6f4ed165d89e1e';

const choix = (page: Page, libelle: string) => page.locator('.plan-de-jeu label', { hasText: libelle }).locator('select');

async function ouvrirMatchInteractif(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Boston Beacons/ }).click();
  await page.getByLabel('Adversaire').selectOption({ label: 'New York Skyliners' });
  await page.getByLabel('À domicile').check();
  await page.getByLabel('Graine').fill('2026');
  await page.getByRole('button', { name: 'Match interactif' }).click();
  await expect(page.getByRole('heading', { name: 'Avant le coup d’envoi' })).toBeVisible();
}

/** Zone et rythme rapide avant le match, puis un temps-mort au premier arrêt de jeu ; rend l'empreinte du match. */
async function jouerAvecDecisions(page: Page): Promise<string> {
  await ouvrirMatchInteractif(page);
  await choix(page, 'Défense').selectOption('zone');
  await expect(choix(page, 'Défense')).toHaveValue('zone');
  await choix(page, 'Rythme').selectOption('rapide');
  await expect(choix(page, 'Rythme')).toHaveValue('rapide');
  await page.getByRole('button', { name: 'Reprendre le match' }).click();
  await page.getByRole('button', { name: 'Prochain arrêt de jeu' }).click();
  await expect(page.getByRole('heading', { name: /Arrêt de jeu/ })).toBeVisible();
  await page.getByRole('button', { name: /^Temps-mort/ }).click();
  await expect(page.getByRole('button', { name: /^Temps-mort/ })).toBeDisabled();
  await page.getByRole('button', { name: 'Reprendre le match' }).click();
  await expect(page.getByRole('region', { name: 'Commentaire' })).toContainText('défense de zone');
  await page.getByRole('button', { name: 'Aller à la fin du match' }).click();
  await page.getByRole('button', { name: 'Voir le box score' }).click();
  const code = page.locator('code');
  await expect(code).toHaveText(/^[0-9a-f]{16}$/);
  return (await code.textContent())!;
}

test('sans décision, le match interactif est le match de référence', async ({ page }) => {
  await ouvrirMatchInteractif(page);
  await page.getByRole('button', { name: 'Reprendre le match' }).click();
  await expect(page.getByRole('region', { name: 'Commentaire' }).locator('li').first()).toBeVisible();
  await page.getByRole('button', { name: 'Aller à la fin du match' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Terminé' })).toBeVisible();
  await page.getByRole('button', { name: 'Voir le box score' }).click();
  await expect(page.locator('code')).toHaveText(EMPREINTE_REFERENCE);
});

test('les décisions du coach changent le match ; les mêmes décisions redonnent le même match', async ({ page }) => {
  const premiere = await jouerAvecDecisions(page);
  expect(premiere).not.toBe(EMPREINTE_REFERENCE);
  const seconde = await jouerAvecDecisions(page);
  expect(seconde).toBe(premiere);
});

test('en saison, le match interactif se reprend après rechargement puis est enregistré', async ({ page }) => {
  test.setTimeout(60_000);
  page.on('dialog', (d) => void d.accept());
  await page.goto('/');
  await page.getByRole('button', { name: /Boston Beacons/ }).click();
  await page.getByRole('button', { name: 'Commencer la saison' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saison régulière' })).toBeVisible();

  // Le premier jour où Boston joue.
  for (let n = 0; n < 5; n++) {
    await page.getByRole('button', { name: 'Prochain match en interactif' }).click();
    const avantMatch = page.getByRole('heading', { name: 'Avant le coup d’envoi' });
    await expect(avantMatch.or(page.getByRole('alert'))).toBeVisible();
    if (await avantMatch.isVisible()) break;
    await page.getByRole('button', { name: 'Jour suivant' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Avant le coup d’envoi' })).toBeVisible();
  await choix(page, 'Tirs à trois points').selectOption('plus');
  await expect(choix(page, 'Tirs à trois points')).toHaveValue('plus');
  await page.getByRole('button', { name: 'Reprendre le match' }).click();
  await page.getByRole('button', { name: 'Prochain arrêt de jeu' }).click();
  await expect(page.getByRole('heading', { name: /Arrêt de jeu/ })).toBeVisible();
  const chrono = await page.getByRole('status').first().textContent();

  // Rechargement : la partie et le match en cours sont dans IndexedDB.
  await page.reload();
  await page.getByRole('button', { name: 'Reprendre la partie' }).click();
  await page.getByRole('button', { name: 'Reprendre le match interactif' }).click();
  await expect(page.getByRole('heading', { name: /Arrêt de jeu/ })).toBeVisible();
  await expect(page.getByRole('status').first()).toHaveText(chrono!);
  await expect(choix(page, 'Tirs à trois points')).toHaveValue('plus');

  await page.getByRole('button', { name: 'Aller à la fin du match' }).click();
  await page.getByRole('button', { name: 'Voir le box score' }).click();
  await expect(page.locator('code')).toHaveText(/^[0-9a-f]{16}$/);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page
    .getByRole('button', { name: /Retour/ })
    .first()
    .click();
  await expect(page.getByRole('button', { name: 'Prochain match en interactif' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Saison régulière' })).toContainText(/bilan [01]-[01]/);
});
