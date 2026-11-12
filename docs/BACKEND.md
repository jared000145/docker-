# Backend reconstruit : installation et état réel

Le dépôt fourni ne contenait pas le backend. Cette version reconstruit une base
depuis le contrat TypeScript : **105 tables**, relations connues, neuf migrations,
politiques RLS, fonctions de connexion et onze points d’entrée Edge.
Les valeurs par défaut et contraintes qui n’étaient pas présentes dans les types
sont des choix de reconstruction. Ce n’est pas une copie de la base d’origine.

## Démarrer Supabase en local

Installer Docker Desktop et Node 22+, puis lancer Docker :

```sh
npm ci
npm run backend:start
```

La CLI Supabase applique les migrations lors du premier démarrage.
Pour réappliquer le schéma sur une base locale de développement vide :
`npx supabase db reset` (efface les données locales).

Récupérer l’URL API et la clé **publique** affichées par `npx supabase status`,
puis les renseigner dans `.env` :

```dotenv
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_PUBLISHABLE_KEY=cle_publique_locale
```

Copier `supabase/functions/.env.example` vers `supabase/functions/.env`, puis :

```sh
npm run backend:serve
```

Adapter `PUBLIC_APP_URL` et `ALLOWED_ORIGINS` au port utilisé par Vite.
Pour tester depuis un téléphone, utiliser l’adresse réseau du serveur et configurer
HTTPS pour un environnement Android distribué ; `127.0.0.1` désigne le téléphone lui-même.

## Premier compte

Le service d’inscription libre est désactivé. Les comptes sont créés par l’administration.
Créer le premier super administrateur depuis un terminal PowerShell, avec les valeurs
locales issues de `supabase status` :

```powershell
$env:SUPABASE_URL = 'http://127.0.0.1:54321'
$env:SUPABASE_SERVICE_ROLE_KEY = 'cle_service_locale'
$env:BOOTSTRAP_EMAIL = 'admin@votre-domaine.fr'
$env:BOOTSTRAP_PASSWORD = 'votre-mot-de-passe-de-12-caracteres-minimum'
npm run backend:bootstrap
Remove-Item Env:SUPABASE_SERVICE_ROLE_KEY, Env:BOOTSTRAP_PASSWORD
```

La clé de service et les mots de passe ne doivent jamais figurer dans `.env` côté
Vite ni dans le dépôt. Le script ne les affiche pas.
Se connecter dans l’onglet **Email**, créer un établissement dans l’espace super
administrateur, puis son compte administrateur principal.

## Disponible dans cette reconstruction

Le parcours de dépôt sécurisé, validation, création du compte principal et essai est
décrit dans [MISE_EN_LIGNE.md](MISE_EN_LIGNE.md). Le super administrateur reçoit les
demandes via Realtime et suit les abonnements. Ces flux passent les tests SQL locaux ;
aucun service cloud n’est encore déployé dans cette session.

- Tables et relations décrites dans le contrat d’origine, avec RLS activée.
- Isolation par établissement, lecture des données personnelles, accès parent lié
  à son enfant, permissions par module pour les membres de l’équipe.
- Création de comptes étudiants, professeurs, parents, équipe et administrateurs.
  La création du profil et du rôle est transactionnelle ; un échec supprime le compte
  Auth nouvellement créé. Les frais ne sont pas générés automatiquement.
- Création d’un administrateur d’établissement depuis le super administrateur.
- Modification du mot de passe par un administrateur principal autorisé.
- Vérification de l’établissement et de ses paramètres publics sans exposer sa clé.
- Récupération par email et limitation d’une demande par identifiant par minute.
  La récupération par matricule nécessite une adresse de secours vérifiée et la
  configuration de Resend. Configurer et tester SMTP pour les comptes par email.
- Buckets privés pour les dossiers et médias de conversation ; avatars publics.
- Contrôles de cohérence entre utilisateur et établissement, montants de paiement
  non négatifs et notes universitaires comprises entre 0 et 20.

## Encore à implémenter et valider

Le fonctionnement complet demandé n’est **pas encore atteint**. Les éléments suivants
ne sont pas reproduits à partir du seul contrat de types :

- RPC de calcul des dettes, décisions annuelles, statistiques de trimestre,
  génération des candidats, vérification publique des documents et recherche globale.
- Affectations et autorisations professeur complètes : l’ancien code reconnaît
  encore certains enseignants par leur nom. Il faut migrer vers des identifiants stables.
- Sauvegardes/restauration Drive, imports complexes, clôture annuelle, orientation,
  chatbot, synchronisation de bibliothèque et notifications externes.
- Le changement d’adresse email d’un administrateur existant nécessite encore un
  parcours de vérification ; son mot de passe peut être modifié par le super administrateur.
- Tous les usages de Storage, groupes de discussion et Realtime doivent être testés
  sur un véritable serveur Supabase ; les politiques sont volontairement restrictives.
- Traduction FR/EN intégrale des modules métier, liens de récupération Android,
  génération et signature d’un APK release, essai sur appareil.

Le fichier `backend-inventory.json` recense les dépendances serveur du frontend.
Ne pas activer un parcours métier sans sa fonction correspondante et ses tests.

## Contrôles exécutables

```sh
npm run typecheck
npm run lint
npm test
npm run test:backend
node scripts/test-functions.mjs
npm run build
```

Les tests SQL utilisent un vrai moteur PostgreSQL embarqué (PGlite), avec de petits
schémas de test simulant Auth et Storage. Ils vérifient les migrations, l’isolation
des établissements, les modifications personnelles, les tentatives d’élévation de
droits, les RPC de connexion et la cohérence des paiements.
Ils ne remplacent pas un test de bout en bout de Supabase Auth, Storage et Edge Runtime.

Les tests Edge exécutent le gestionnaire transpilé et contrôlent la validation des
requêtes, CORS et l’exigence de connexion. La création réelle de comptes et l’envoi
d’emails restent à tester avec les services actifs.

Références : [développement local Supabase](https://supabase.com/docs/guides/local-development/cli-workflows),
[règles RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
