// Parcours de la tranche 7 : scouter la classe pendant la saison (fourchettes, observations), puis, la saison terminée,
// lire la loterie 3-2-1 et l'ordre des 60 choix, et faire la soirée de Draft (choix du GM ou délégation au staff).
// Tranche 8 : puis passer à la saison suivante (intersaison) et retrouver la saison écoulée dans l'histoire.
// Tranche 9 : l'intersaison passe par la free agency.
import { expect, test } from '@playwright/test';

test('le GM scoute la classe, lit la loterie, fait sa Draft et passe à la saison suivante', async ({ page }) => {
  test.setTimeout(120_000);
  page.on('dialog', (d) => void d.accept());
  await page.goto('/');
  await page.getByRole('button', { name: /Boston Beacons/ }).click();
  await page.getByRole('button', { name: 'Commencer la saison' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saison régulière' })).toBeVisible();

  // Pendant la saison : la classe, vue par le staff, avec des fourchettes ; observer resserre la fourchette.
  await page.getByRole('button', { name: 'Draft', exact: true }).click();
  const classe = page.getByRole('region', { name: 'Classe de la Draft' });
  await expect(classe.locator('tbody tr')).toHaveCount(100);
  const premier = classe.locator('tbody tr').first();
  const potentiel = premier.locator('td').nth(6);
  const ecart = async () => {
    const [, bas, haut] = /\((\d+)–(\d+)\)/.exec((await potentiel.textContent()) ?? '')!.map(Number);
    return haut! - bas!;
  };
  const avant = await ecart();
  for (let i = 0; i < 4; i++) await premier.getByRole('button', { name: /^Observer/ }).click();
  await expect(page.getByText(/Observations restantes : 56 sur 60/)).toBeVisible();
  expect(await ecart()).toBeLessThan(avant);

  // Fin de la saison : loterie et ordre des choix.
  await page.getByRole('button', { name: 'Jusqu’au titre' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saison terminée' })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByRole('region', { name: 'Loterie' }).locator('tbody tr')).toHaveCount(16);
  await expect(page.getByRole('region', { name: 'Ordre des choix' }).locator('tbody tr')).toHaveCount(60);

  // Soirée de Draft : le GM choisit s'il a la main, puis délègue la fin à son staff.
  const choisir = page.getByRole('button', { name: 'Choisir' }).first();
  const ordre = page.getByRole('region', { name: 'Ordre des choix' });
  await page.getByRole('button', { name: /Avancer jusqu’à mon prochain choix|Lancer la Draft/ }).click();
  await expect(page.getByText(/À vous de choisir|Salaires du 1er tour/).first()).toBeVisible();
  if (await choisir.isVisible()) {
    const ligne = classe.locator('tbody tr').filter({ has: choisir }).first();
    const nom = (await ligne.locator('th').textContent())!.trim();
    await choisir.click();
    await expect(ordre.getByText(nom, { exact: true })).toBeVisible();
  }
  const delegation = page.getByLabel('Mon staff choisit pour moi');
  if (await delegation.isVisible()) {
    await delegation.click();
    await expect(delegation).toBeChecked();
    const lancer = page.getByRole('button', { name: 'Lancer la Draft jusqu’au bout' });
    if (await lancer.isVisible()) await lancer.click();
  }
  await expect(page.getByText(/Salaires du 1er tour/)).toBeVisible();
  await expect(ordre.getByText('À vous de choisir')).toHaveCount(0);

  // Le vivier des joueurs hors NBA.
  await page.getByRole('button', { name: 'Hors NBA' }).click();
  // Tranche 10 : l'IA en signe quelques-uns en cours de saison (two-way, exception de difficulté).
  const vivier = await page.getByRole('region', { name: 'Vivier' }).locator('tbody tr').count();
  expect(vivier).toBeGreaterThan(290);
  expect(vivier).toBeLessThanOrEqual(320);

  // Tranche 8 : l'intersaison, puis la saison suivante, jouable, avec la saison écoulée dans l'histoire.
  // Tranche 9 : l'intersaison s'ouvre sur la free agency (journées) ; une journée, puis le camp.
  await page.getByRole('button', { name: 'Passer à la saison 2027–2028' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('2027–2028', { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: /Free agency · journée 0 sur/ })).toBeVisible();
  await page.getByRole('button', { name: 'Journée suivante' }).click();
  await expect(page.getByRole('heading', { name: /Free agency · journée 1 sur/ })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /Terminer la free agency/ }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saison régulière' })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Histoire' }).click();
  await expect(page.getByTestId('histoire').locator('tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: 'Masse salariale' }).click();
  await expect(page.getByRole('heading', { name: 'Masse salariale 2027-28' })).toBeVisible();
  await page.getByRole('button', { name: 'Jour suivant' }).click();
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: /2027–2028|Saison régulière/ })
      .first(),
  ).toBeVisible();
});
