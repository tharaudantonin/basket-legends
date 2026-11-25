// Parcours de la tranche 9 : le GM vérifie un échange (CBA et avis de l'IA, « Qu'est-ce qu'il vous faudrait ? »),
// compose lui-même son équipe, change une délégation, puis joue un jour de saison avec sa composition.
import { expect, test } from '@playwright/test';

test('le GM prépare un échange, compose son équipe et joue un jour', async ({ page }) => {
  test.setTimeout(90_000);
  page.on('dialog', (d) => void d.accept());
  await page.goto('/');
  await page.getByRole('button', { name: /Boston Beacons/ }).click();
  await page.getByRole('button', { name: 'Commencer la saison' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saison régulière' })).toBeVisible();

  // Échanges : un joueur demandé, la contre-proposition de l'équipe, la vérification selon la CBA.
  await page.getByRole('button', { name: 'Échanges', exact: true }).click();
  const zone = page.getByRole('region', { name: 'Échanges' });
  await zone.getByLabel('Partenaire').selectOption({ label: 'Utah Desert Raptors' });
  await zone.locator('fieldset').nth(1).locator('input[type=checkbox]').nth(3).check();
  await zone.getByRole('button', { name: 'Qu’est-ce qu’il vous faudrait ?' }).click();
  await expect(zone.getByRole('status')).toBeVisible({ timeout: 30_000 });
  await zone.getByRole('button', { name: 'Vérifier' }).click();
  await expect(zone.getByRole('status')).toContainText(/CBA|au plus|Refusé|Marché conclu|ne détient|Stepien/, { timeout: 30_000 });

  // Staff et composition : le GM compose lui-même, monte un remplaçant dans le cinq, change une délégation.
  await page.getByRole('button', { name: 'Staff et composition' }).click();
  await expect(page.getByRole('region', { name: 'Staff' })).toContainText('Entraîneur principal');
  await page.getByRole('button', { name: 'Composer moi-même' }).click();
  await expect(page.getByRole('button', { name: 'Rendre la composition au staff' })).toBeVisible({ timeout: 30_000 });
  const composition = page.getByRole('region', { name: 'Composition' });
  const sixieme = (await composition.locator('li').nth(5).innerText()).split(' (')[0]!;
  await composition
    .getByRole('button', { name: /^Monter/ })
    .nth(5)
    .click();
  await expect(composition.locator('li').nth(4)).toContainText(sixieme.trim(), { timeout: 30_000 });
  await page.getByLabel('Délégation : Échanges').selectOption('staff');
  await expect(page.getByLabel('Délégation : Échanges')).toHaveValue('staff', { timeout: 30_000 });

  // Un jour de saison avec la composition du GM ; le journal des transactions s'affiche.
  await page.getByRole('button', { name: 'Jour suivant' }).click();
  await page.getByRole('button', { name: 'Transactions' }).click();
  await expect(page.getByRole('region', { name: 'Transactions' })).toContainText('Transactions de la saison', { timeout: 30_000 });
});
