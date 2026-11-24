// Parcours de la tranche 6 : contrats et masse salariale — salaires de l'effectif, fiche du joueur, onglet « Masse
// salariale » de la saison (repères de la CBA, masses de la ligue, contrôle d'une signature).
import { expect, test } from '@playwright/test';

test('l’effectif montre les salaires et les contrats two-way', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Boston Beacons/ }).click();
  const effectif = page.getByRole('region', { name: 'Effectif' });
  await expect(effectif.locator('tbody tr', { hasText: 'two-way' })).toHaveCount(3);
  await expect(effectif.locator('tbody tr').first()).toContainText('M$');

  await effectif.locator('tbody th button').first().click();
  const contrat = page.getByRole('region', { name: 'Contrat' });
  await expect(contrat).toContainText('Standard');
  await expect(contrat).toContainText('2026-27');
});

test('la masse salariale de la saison suit la CBA et contrôle les signatures', async ({ page }) => {
  page.on('dialog', (d) => void d.accept());
  await page.goto('/');
  await page.getByRole('button', { name: /Boston Beacons/ }).click();
  await page.getByRole('button', { name: 'Commencer la saison' }).click();
  await page.getByRole('button', { name: 'Masse salariale' }).click();

  // Masse publiée de Boston au 24/11/2026 (SalarySwish) : 198 722 406 $, sous le seuil de taxe.
  await expect(page.getByTestId('situation-salariale')).toContainText('198,722 M$ · Au-dessus du plafond');
  await expect(page.getByTestId('situation-salariale')).toContainText('plafond strict au premier apron');
  await expect(page.getByRole('table', { name: 'Masses salariales des 30 équipes' }).locator('tbody tr')).toHaveCount(30);

  // Un vétéran au minimum pour un an : il ne compte que pour le minimum d'un joueur de deux ans.
  const verdict = page.getByTestId('verdict-signature');
  await expect(verdict).toContainText('Signature possible : 2,449 M$ imputés');
  // Au-dessus du plafond, plus d'espace salarial.
  await page.getByRole('combobox', { name: /^Moyen/ }).selectOption({ label: 'Espace salarial' });
  await page.getByLabel('Salaire (dollars)').fill('5000000');
  await expect(verdict).toContainText('Signature impossible');
  await expect(verdict).toContainText("l'équipe n'y a pas droit");
});
