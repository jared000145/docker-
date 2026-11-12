# RectorPlus

Application de gestion scolaire React / TypeScript, web et Android avec Capacitor.

## Aperçu local en direct

- Accueil : http://127.0.0.1:4173/
- Démonstration interactive : http://127.0.0.1:4173/apercu

Les pages publiques et la démonstration fonctionnent sans configuration Supabase.
Les modifications du code sont visibles immédiatement grâce au rechargement Vite.
Dans la démonstration, vous pouvez ajouter des élèves fictifs, saisir des notes,
filtrer les listes et simuler un règlement. Les essais sont enregistrés uniquement
dans le stockage local du navigateur, sous `rectorplus-demo-v1`.
Les comptes réels et les données des établissements restent indépendants.

Sur cette machine, `./start-local.cmd` utilise aussi les outils locaux préparés dans
`.tools/` si Node n’est pas installé. Adresse : http://127.0.0.1:4173.

## Lancer le web

Avec Node 22 ou supérieur :

```sh
npm ci
```

Copier `.env.example` vers `.env`, renseigner la connexion Supabase, puis :

```sh
npm run dev
```

Adresse : http://localhost:8080. Les pages publiques restent accessibles sans configuration.
Un écran de configuration apparaît à la connexion tant que Supabase n’est pas renseigné.
Si le port est occupé : `npm run dev -- --port 4173`.

- [Installation web et Android](docs/INSTALLATION.md)
- [Backend local reconstruit et fonctions restantes](docs/BACKEND.md)
- [Mise en ligne réelle, validations, abonnements et APK de test](docs/MISE_EN_LIGNE.md)

## Vérifier le projet

```sh
npm run typecheck
npm run lint
npm test
npm run test:backend
node scripts/test-functions.mjs
npm run build
```

## Android

Le dossier `android/` est généré. Après configuration de Supabase :

```sh
npm run android:sync
npm run android:open
```

Android Studio, le SDK Android 36 et le JDK compatible sont nécessaires pour compiler.
Sur Windows : `npm run android:apk` produit un APK de développement si ces outils sont installés.

## État

La compilation web, les premiers tests et la reconstruction initiale de la base sont disponibles.
Le produit complet n’est pas encore prêt à publier : certaines fonctions serveur et traductions
restent à réaliser, le backend réel et l’application Android doivent être testés.
Voir les limites détaillées dans le guide backend. Aucun mode hors ligne n’est promis.
