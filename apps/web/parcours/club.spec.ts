// Parcours de la tranche 10 : le GM lit l'objectif de son propriétaire, promet un rôle dans le vestiaire, se voit
// refuser un contrat de 10 jours avant le 5 janvier, joue une semaine et suit la G League.
import { expect, test } from '@playwright/test';

test('le GM suit son propriétaire, son vestiaire et la G League', async ({ page }) => {
  test.setTimeout(120_000);
  page.on('dialog', (d) => void d.accept());
  await page.goto('/');
  await page.getByRole('button', { name: /Boston Beacons/ }).click();
  await page.getByRole('button', { name: 'Commencer la saison' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saison régulière' })).toBeVisible();

  // Le propriétaire et l'objectif de la saison.
  await page.getByRole('button', { name: /^Club/ }).click();
  const proprietaire = page.getByRole('region', { name: 'Propriétaire' });
  await expect(proprietaire).toContainText('Objectif 2026–2027');
  await expect(proprietaire).toContainText('Confiance');

  // Le vestiaire : un rôle promis.
  const vestiaire = page.getByRole('region', { name: 'Vestiaire', exact: true });
  await expect(vestiaire).toContainText('Moral du groupe');
  await vestiaire.getByRole('combobox').first().selectOption('titulaire');
  await expect(vestiaire.getByRole('combobox').first()).toHaveValue('titulaire', { timeout: 30_000 });

  // Avant le 5 janvier, pas de contrat de 10 jours (règle sourcée).
  const contrats = page.getByRole('region', { name: 'Contrats en cours de saison' });
  await contrats.getByRole('button', { name: '10 jours', exact: true }).first().click();
  await expect(page.getByRole('alert')).toContainText('Pas de contrat de 10 jours avant', { timeout: 30_000 });

  // Une semaine, puis la G League (Tip-Off en cours).
  await page.getByRole('button', { name: 'Une semaine' }).click();
  await page.getByRole('button', { name: 'G League' }).click();
  const g = page.getByRole('region', { name: 'G League', exact: true });
  await expect(g).toContainText('30 équipes affiliées', { timeout: 30_000 });
  await expect(page.getByRole('region', { name: 'Votre équipe affiliée' }).locator('tbody tr')).not.toHaveCount(0);
});
