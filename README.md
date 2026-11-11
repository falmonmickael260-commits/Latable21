# La Table 21 — Godot 3D + serveur multijoueur

Le jeu est désormais réalisé dans **Godot 4.6**, avec un export WebGL 2 affiché à `/table`. Le serveur Node/Socket.IO existant conserve les règles, les places, les soldes et les résultats. Le navigateur et les applications natives Godot peuvent rejoindre la même table.

## Démarrer

Installer Node 22+, Godot **4.6.3** et les modèles d’export de la **même version** (Godot : Éditeur → Gérer les modèles d’export).

```bash
npm ci
npm run game:export
npm run dev
```

Ouvrir http://localhost:3000/table et choisir un pseudo. `GODOT_BIN` permet de sélectionner un autre chemin vers l’exécutable Godot.

Pour travailler dans l’éditeur, importer `godot/project.godot`, puis lancer la scène `scenes/casino.tscn` avec F6. Le serveur doit rester démarré. En ligne de commande :

```bash
godot --path godot -- --server=ws://127.0.0.1:3000 --pseudo=Mickael
```

`--demo` affiche une scène locale de démonstration clairement identifiée, sans multijoueur ni fausses transactions. `--reduced-motion` désactive les animations ; les boutons Son et Animations permettent aussi de les régler en jeu.

## Expérience de jeu

- Une salle et une table **en vraie 3D**, éclairées, avec bordure, tapis, sièges, sabot et réserve de jetons.
- Caméra basse face à la table, déplacement animé vers une place confirmée par le serveur. Cliquer sur un cercle du tapis ou sur un bouton de place pour s’asseoir.
- Places libres, personnelles et occupées distinctes. La prise d’une place occupée est rejetée côté serveur.
- Possibilité de réserver plusieurs cases libres ; sélectionner une de ses cases dans la barre, puis choisir sa mise. Chaque case a sa propre main, sa pile de jetons et son résultat.
- Cartes agrandies, valeurs et symboles contrastés, total lisible juste au-dessus de chaque main (indépendant pour les cases et mains séparées). Le total du croupier exclut toute carte encore cachée.
- Cartes 3D distribuées depuis les mains du croupier, jetons qui se posent, mouvement du bras synchronisé aux distributions, respiration et sons synthétisés.
- Tirer, rester, doubler et séparer selon les possibilités de la main active, avec délai de décision et résultats du serveur.
- Reconnexion automatique avec identité conservée dans le stockage utilisateur Godot/IndexedDB. Les actions restent désactivées pendant la déconnexion.

Le rendu active l’anticrénelage MSAA, le filtrage anisotrope et les polices 3D MSDF. La bordure et les sièges sont arrondis, le costume et le visage utilisent des surfaces à normales lissées, et l’éclairage neutre conserve les couleurs du tapis et du laiton.

La direction visuelle actuelle est **stylisée et procédurale** : le croupier est constitué de maillages Godot animés, pas d’un humain photoréaliste ni d’un personnage capturé. Les formes et matériaux sont des bases modifiables dans le projet ; aucun service de génération ou asset payant n’est nécessaire.

## Aperçu du rendu

![Capture du rendu Godot](docs/visuels/rendu-godot-1080p.png)

Capture réelle de l’export WebGL en 1920×1080, en mode démonstration local. Les cartes de cet aperçu illustrent la scène ; il ne s’agit pas d’une partie réseau enregistrée.

## Architecture

| Emplacement | Rôle |
| --- | --- |
| `godot/project.godot` | Projet source Godot 4.6 |
| `godot/scripts/casino.gd` | Scène 3D, caméra, cartes, jetons, animations et commandes |
| `godot/scripts/casino_network.gd` | Client Socket.IO v4 / Engine.IO v4 sur WebSocket, namespace par défaut |
| `src/server/game-manager.ts` | Moteur autoritaire de blackjack |
| `src/server/socket-server.ts` | Salon partagé et événements temps réel |
| `src/app/table/page.tsx` | Intégration de l’export Godot dans le site |
| `scripts/export-godot.mjs` | Import et export Web sans threads |
| `.github/workflows/godot-web.yml` | Construction et vérifications, avec artefact Web téléchargeable |

L’ancien affichage React reste dans `src/components/casino` comme référence, mais n’est plus utilisé par `/table`. Le jeu Godot n’utilise plus la photo fixe de table.

L’export n’utilise pas de threads : **pas d’en-têtes COOP/COEP exigés**. Il requiert WebGL 2 et WebAssembly. Servir ensemble tous les fichiers de `public/game`, y compris `.wasm` et `.pck`. En production HTTPS, le client sélectionne automatiquement `wss://` sur le même hôte. Le proxy d’hébergement doit transmettre les upgrades WebSocket de `/socket.io/`.

## Construire et vérifier

```bash
npm test
npm run build
# Avec le serveur démarré, sur une table libre :
npm run test:godot
godot --headless --path godot --script tests/scene_test.gd
godot --headless --path godot --script tests/cards_test.gd
```

`npm run build` exporte Godot, puis construit Next.js. Le pipeline GitHub installe Godot et ses templates et fournit un artefact `la-table-21-godot-web`. Les fichiers générés dans `public/game/` ne sont pas versionnés. Pour mettre à jour le rendu local après une modification Godot, relancer `npm run game:export`.

Les tests couvrent les réservations multiples, le refus des places occupées, les mises et remboursements indépendants, les doubles débits, les montants invalides et l’interdiction de quitter/annuler pendant la manche. Les tests Godot vérifient le transport réel, une manche complète à deux cases et les objets créés dans la scène.

## Règles et limites actuelles

Blackjack européen sans carte cachée initiale (ENHC). Croupier reste à 17 ; blackjack 3:2. Split sur deux rangs identiques, sans resplit ; une carte pour les as séparés. Double sur deux cartes si le solde suffit. Mises de 100 à 500 jetons virtuels.

Une seule table partagée et un stockage **en mémoire** : redémarrer le serveur efface les joueurs, places et soldes. Le schéma Supabase est disponible mais non branché. Le client n’ajoute ni argent réel ni système de paiement. Le projet nécessite encore des modèles et animations d’artiste pour une direction photoréaliste, et une validation sur de vrais appareils mobiles pour les performances/touches/clavier virtuel.

La police embarquée DejaVu Sans est distribuée avec sa licence dans `godot/assets/FONT-LICENSE.txt`.
