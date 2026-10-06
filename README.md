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
- **UI** — scène 2D composée par-dessus une image de fond (React + Tailwind + Framer Motion, [src/components/casino](src/components/casino)) : table SVG, places sur un arc (place 1 = droite, place 8 = gauche, cohérent avec l'ordre de distribution serveur 1→8), croupier rendu comme sprite (voir ci-dessous). Thème "luxury casino" (encre, feutrine, or, Cinzel/Jost).
- **Son** — généré via WebAudio ([src/lib/sound.ts](src/lib/sound.ts)), aucun fichier audio tiers.

## Le croupier

[public/images/dealer-suit.png](public/images/dealer-suit.png) est un rendu statique (transparent) d'un personnage 3D rigué en costume, issu d'un pack "Individual Characters" (même famille que le pack CC0 Quaternius "Universal Base Characters") trouvé dans un autre projet de l'utilisateur. Le rendu a été fait avec Three.js hors-ligne (script jetable, voir historique) puis composé comme sprite 2D — cohérent avec le reste de la scène (image + overlays), sans réintroduire un viewport WebGL complet. Licence du pack "Individual Characters" non confirmée explicitement (pas de fichier LICENSE dans ce sous-dossier précis) mais vraisemblablement CC0 comme le reste de la lignée Quaternius.

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
- **Croupier animé** — le sprite est actuellement statique (pose fixe + léger mouvement CSS de respiration). Des rendus supplémentaires (autres poses/angles, voire une sprite-sheet) seraient nécessaires pour une vraie distribution/révélation animée du personnage lui-même.
