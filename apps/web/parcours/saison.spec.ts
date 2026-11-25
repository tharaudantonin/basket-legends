// Parcours de la tranche 4 : lancer une saison, avancer, retrouver la partie après rechargement (IndexedDB), revivre un
// match, aller jusqu'au titre et lire le palmarès.
import { expect, test } from '@playwright/test';

test('une saison se lance, se sauvegarde et se joue jusqu’au titre', async ({ page }) => {
  test.setTimeout(60_000);
  page.on('dialog', (d) => void d.accept());
  await page.goto('/');
  await page.getByRole('button', { name: /Boston Beacons/ }).click();
  await page.getByRole('button', { name: 'Commencer la saison' }).click();
  const statut = page.getByRole('status').filter({ hasText: 'Saison régulière' });
  await expect(statut).toBeVisible();

  await page.getByRole('button', { name: 'Une semaine' }).click();
  // Au moins un match joué, gagné ou perdu : la graine vient de l'horloge, le premier match peut être une défaite.
  await expect(statut).toContainText(/bilan (?!0-0\b)\d+-\d+/);
  const avant = await statut.textContent();

  // La partie est enregistrée dans le navigateur : on la retrouve après rechargement.
  await page.reload();
  await page.getByRole('button', { name: 'Reprendre la partie' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saison régulière' })).toHaveText(avant!);

  // Classements : 15 équipes par conférence.
  await page.getByRole('button', { name: 'Classements' }).click();
  await expect(page.getByRole('region', { name: 'Classement Conférence Est' }).locator('tbody tr')).toHaveCount(15);

  // Revivre un match du calendrier en mode commenté.
  await page.getByRole('button', { name: 'Calendrier' }).click();
  await page.getByRole('button', { name: 'Commenté' }).first().click();
  await page.getByRole('button', { name: 'Aller à la fin' }).click();
  await expect(page.getByRole('region', { name: 'Commentaire' }).locator('li').first()).toContainText('Fin du match');
  await page.getByRole('button', { name: "Retour à l'effectif" }).click();

  // Jusqu'au titre.
  await page.getByRole('button', { name: 'Jusqu’au titre' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saison terminée' })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Palmarès' }).click();
  await expect(page.getByText(/champion 2026–2027/)).toBeVisible();
  await expect(page.getByText('MVP de la saison')).toBeVisible();
  await page.getByRole('button', { name: 'All-Star', exact: true }).click();
  await expect(page.getByText(/MVP :/)).toBeVisible();
});
