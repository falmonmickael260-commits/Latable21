# La Table 21 — Blackjack

Table de Blackjack multijoueur premium, cinématique, server-authoritative.

## Démarrer

```bash
npm install
npm run dev
```

Ouvre http://localhost:3000 (ou `PORT=xxxx npm run dev` pour un autre port).

## Architecture

- **Next.js App Router + custom server** ([server.ts](server.ts)) — Next.js et Socket.io partagent le même serveur HTTP Node (Next 16 attend qu'on lui passe son propre `httpServer` via `next({ httpServer })` pour que le HMR/Turbopack s'y attache correctement).
- **Serveur autoritaire** ([src/server/game-manager.ts](src/server/game-manager.ts)) — toute la logique (sabot, distribution, split/double, résultats, paiements, règle croupier 16/17) tourne côté serveur. Le client ne fait qu'afficher l'état reçu et envoyer des intentions (`hit`, `stand`, …) ; le serveur les valide ou les rejette.
- **Store en mémoire** ([src/server/store.ts](src/server/store.ts)) — façonné exactement comme le futur schéma Supabase ([supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql)) pour que le remplacement par Supabase ne touche que ce fichier.
- **Temps réel** — Socket.io, contrat d'événements typé dans [src/lib/types.ts](src/lib/types.ts).
- **UI** — scène composée par-dessus une photo de fond fixe (React + Tailwind + Framer Motion, [src/components/casino](src/components/casino)). Thème "luxury casino" (encre, feutrine, or, Cinzel/Jost).
- **Son** — généré via WebAudio ([src/lib/sound.ts](src/lib/sound.ts)), aucun fichier audio tiers.

## La table et le croupier

[public/images/table-bg.png](public/images/table-bg.png) est une image fixe générée par IA (table, croupier, salle, 7 places numérotées, chaises) — plus de table/croupier dessinés en SVG/sprite. La scène entière est affichée en "contain fit" à son ratio natif (941×1672, portrait) via [CasinoTable.tsx](src/components/casino/CasinoTable.tsx) : jamais étirée ni recadrée, pour que les positions (places, cartes, croupier) mesurées en % de l'image ([src/lib/table-layout.ts](src/lib/table-layout.ts)) restent toujours exactes, quel que soit l'écran. Sur un écran large (desktop), l'image (portrait) reste centrée avec la photo d'arrière-plan floutée visible de chaque côté — une image dédiée au format paysage reste à faire. Les anciens composants (`Table2D`, `DealerMark`, `Stool`, `LogoPanel`) ont été supprimés.

## Choix confirmés

- **Règle du croupier** : tire à 16 ou moins, reste à 17 ou plus — appliquée côté serveur ([game-manager.ts](src/server/game-manager.ts)) et affichée sur le feutre.
- **Split** autorisé uniquement entre deux cartes de même rang exact (pas de resplit). As splités : une seule carte, stand automatique.
- **Double** autorisé sur toute main de 2 cartes, y compris après split (DAS), si le solde le permet.
- Blackjack européen **sans carte cachée du croupier au départ** (ENHC) : le croupier ne reçoit sa 2ᵉ carte qu'après le tour de tous les joueurs.
- **Timeout joueur** (20s sans action) : auto-hit si ≤16, auto-stand si ≥17 — mirroir de la règle du croupier, pas une règle distincte.

## Ce qui reste

- **Supabase** — schéma prêt ([supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql)), mais le store tourne en mémoire (reset au redémarrage du serveur).
- **Responsive mobile/tablette** — fonctionne mais pas encore optimisé (le plateau est pensé desktop-first comme demandé) ; le positionnement en % réagit aussi différemment selon le ratio d'écran (un viewport très étroit/carré recadre plus serré que prévu).
- **Multi-tables** — un seul `GameManager` singleton tourne actuellement ; le store est déjà façonné pour plusieurs tables, le routage socket reste à faire.
- **Desktop/paysage** — seule une image portrait existe pour l'instant ; sur un écran large elle reste centrée (letterboxée) plutôt que de remplir toute la largeur. Une image dédiée au format paysage réglerait ça.
- **Croupier animé** — le croupier est maintenant une photo fixe (plus de sprite CSS "respiration") ; seules les cartes/jetons posés dessus sont animés.
