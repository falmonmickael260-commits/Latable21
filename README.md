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
- **Son** — généré via WebAudio ([src/lib/sound.ts](src/lib/sound.ts)), aucun fichier audio tiers.

## La table

[public/images/table-scene.png](public/images/table-scene.png) est une photo fournie par l'utilisateur (table + croupier + salle, tout en un) — recadrée depuis l'originale pour retirer une fausse interface (soldes, boutons) qui doublonnait notre vraie interface. Elle est affichée à son ratio naturel (1807×695), centrée et mise en cadre ("contain" calculé explicitement en JS, voir [CasinoTable.tsx](src/components/casino/CasinoTable.tsx)). Chaque place/carte est ancrée par une **fraction** de cette image (ex. `{fx: 0.8551, fy: 0.6}` pour la place 1), mesurée en direct via [useImageBox](src/hooks/useImageBox.ts) — donc l'alignement tient à n'importe quelle taille d'écran. Les éléments de jeu (places, cartes) vivent dans un calque mis à l'échelle en un bloc (même technique que pour les tailles de police/boutons) pour rester proportionnés sur petit comme grand écran.

**7 places** (pas 8) — ce nombre vient directement de la photo fournie.

## Choix confirmés

- **Règle du croupier** : tire à 16 ou moins, reste à 17 ou plus — appliquée côté serveur ([game-manager.ts](src/server/game-manager.ts)) et affichée sur le feutre.
- **Split** autorisé uniquement entre deux cartes de même rang exact (pas de resplit). As splités : une seule carte, stand automatique.
- **Double** autorisé sur toute main de 2 cartes, y compris après split (DAS), si le solde le permet.
- Blackjack européen **sans carte cachée du croupier au départ** (ENHC) : le croupier ne reçoit sa 2ᵉ carte qu'après le tour de tous les joueurs.
- **Timeout joueur** (20s sans action) : auto-hit si ≤16, auto-stand si ≥17 — mirroir de la règle du croupier, pas une règle distincte.
- **Le croupier est une image fixe**, pas animé (pas de geste de distribution) — c'est la limite du choix "photo" : fidèle visuellement, mais statique. Une vidéo en boucle réglerait ça si l'utilisateur en fournit une un jour.

## Ce qui reste

- **Supabase** — schéma prêt ([supabase/migrations/0001_init.sql](supabase/migrations/0001_init.sql)), mais le store tourne en mémoire (reset au redémarrage du serveur).
- **Mobile portrait** — fonctionne (rien ne se chevauche, tout reste cliquable) mais la photo est large (ratio ~2.6:1) et se réduit donc à une bande horizontale sur un téléphone en portrait — limite inhérente à l'usage d'une photo fixe plutôt que d'un plateau redessiné.
- **Multi-tables** — un seul `GameManager` singleton tourne actuellement ; le store est déjà façonné pour plusieurs tables, le routage socket reste à faire.
