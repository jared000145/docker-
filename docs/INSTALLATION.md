# Installation RectorPlus

## Web local

Node 22 ou supérieur, puis :

```sh
npm ci
cp .env.example .env
npm run dev
```

Sous PowerShell : `Copy-Item .env.example .env`.
Renseigner l’URL et la clé publique Supabase avant de redémarrer Vite.
Le serveur est disponible sur http://localhost:8080.

## Android

Installer Android Studio et ses outils SDK, avec le JDK requis par la version de Capacitor.
La configuration officielle est décrite sur https://capacitorjs.com/docs/getting-started/environment-setup.

```sh
npm run android:add
npm run android:sync
npm run android:open
```

Exécuter `android:add` uniquement si le dossier `android` n’existe pas encore.
Sous Windows, `npm run android:apk` construit l’APK de développement dans
`android/app/build/outputs/apk/debug/app-debug.apk`.
Une distribution publique nécessite un APK/AAB release signé avec votre propre clé.
Le binaire embarque `dist`, sans serveur Vite ni URL de développement distante.

## Backend indispensable

Le backend d’origine est absent. Une première reconstruction est fournie dans
`supabase/`, avec un état précis dans [BACKEND.md](BACKEND.md).
Suivre ce guide pour démarrer le backend local et créer le premier administrateur.
Certaines fonctions métier restent à reconstruire ; une base vide ne suffit pas.
Ne jamais exposer la clé `service_role` dans les variables `VITE_*`.

Les rôles doivent être attribués côté serveur. Les gardes React contrôlent la
navigation ; les règles RLS doivent contrôler les données et l’isolation des établissements.
Prévoir des comptes de test pour étudiant, professeur, parent, administrateur,
direction, responsables de validation et super administrateur.

Configurer les URL autorisées de Supabase Auth pour le site web et la récupération
du mot de passe. Dans Android, les liens reçus par email nécessitent un domaine web
public et une stratégie App Links avant une distribution publique.

## Limites explicites

Les données métier nécessitent Internet. Aucun mode hors ligne n’est implémenté.
Le choix FR/EN est mémorisé et couvre une partie de la connexion ; les modules
métier et les messages serveur ne sont pas encore intégralement traduits.
Ne pas considérer l’application prête à publier avant validation avec le backend réel,
tests des différents rôles et essai sur un appareil Android.
