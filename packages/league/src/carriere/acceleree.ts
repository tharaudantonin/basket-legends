// Tranche 8 : saison « accélérée », sans match, pour mesurer la stabilité de la carrière sur 20 saisons en quelques
// secondes (critère de sortie, tests et `npm run carriere`). Le jeu ne l'utilise pas : une vraie saison se joue avec le
// moteur. Ici, l'ordre de la Draft suit la force des équipes (moyenne des huit meilleures notes, la plus faible d'abord),
// sans loterie, et le staff de chaque équipe choisit ses prospects comme dans une vraie Draft.
import type { ContexteLigue, EtatSaison } from '../types';
import { choixDuStaff, recruesDeLaDraft } from '../draft/draft';
import type { ChoixDeDraft } from '../draft/types';

export function terminerSansMatchs(ctx: ContexteLigue, etatInitial: EtatSaison): EtatSaison {
  const etat = structuredClone(etatInitial);
  etat.phase = 'terminee';
  const force = (e: string) => {
    const notes = ctx.equipes[e]!.joueurs.map((j) => j.note).sort((a, b) => b - a);
    return notes.slice(0, 8).reduce((s, x) => s + x, 0);
  };
  const ordre = Object.keys(ctx.equipes).sort((a, b) => force(a) - force(b) || (a < b ? -1 : 1));
  if (etat.draft) {
    const choix: ChoixDeDraft[] = [1, 2].flatMap((tour) =>
      ordre.map((e, i) => ({ tour: tour as 1 | 2, rang: (tour - 1) * ordre.length + i + 1, original: e, detenteur: e })),
    );
    etat.draft = { ...etat.draft, choix, delegue: true };
    for (const c of choix) etat.draft.selections[String(c.rang)] = choixDuStaff(ctx, etat, c.detenteur).id;
    etat.draft.terminee = true;
    etat.draft.recrues = recruesDeLaDraft(ctx, etat.draft);
  }
  return etat;
}
