# Environnement réel de test RectorPlus

## État du projet

Environnement publié le 8 novembre 2026 :

- Web officiel : https://rectorplus.com (également https://www.rectorplus.com).
- Adresse Vercel conservée : https://rectorplus.vercel.app.
- Domaine IONOS raccordé à Vercel le 9 novembre 2026 ; les enregistrements A de
  `@` et `www` pointent vers `216.198.79.1`. Certificat HTTPS émis pour les deux.
  Les DNS de messagerie IONOS sont conservés. Supabase Auth et `PUBLIC_APP_URL`
  utilisent `https://rectorplus.com`, avec les redirections Vercel conservées.
- Projet Supabase : `rectorplus` (`ruouwtuetbuyxwrpqzfc`), dix migrations appliquées.
- Quatorze fonctions Edge sont déployées pour les comptes et le parcours d’inscription.
- Précontrôle documentaire et emails de dossier préparés ; services externes non
  configurés. Le dépôt est fermé tant que l’analyse n’est pas activée. Voir
  [INSCRIPTION_ET_EMAILS.md](INSCRIPTION_ET_EMAILS.md).
- Les variables publiques de production sont configurées dans Vercel et `.env.local`.
- Auth utilise le domaine public et les redirections de récupération locales ;
  l’inscription libre est désactivée. Les origines des fonctions sont configurées.
- Premier super administrateur provisionné pour le propriétaire ; rôle vérifié en base
  et demande d’envoi du lien de définition du mot de passe acceptée par Supabase Auth.

Vérifications réalisées : build hébergé réussi, pages publiques HTTP 200,
prévol CORS autorisé, demande de préinscription invalide refusée (400),
fonction administrative sans connexion refusée (401), lecture anonyme des
établissements sans exposition de données.

Restent à vérifier avec le propriétaire : réception du mail et première connexion,
dépôt complet avec documents, validation d’un établissement, invitation de son
responsable et synchronisation Realtime entre deux sessions authentifiées.
Le SMTP personnalisé et l’APK restent à finaliser. La démonstration `/apercu`
reste une simulation indépendante. Les sections suivantes décrivent la procédure
de configuration et les futurs redéploiements.

### Connexion du super administrateur

L’entrée directe est https://rectorplus.vercel.app/super-admin. Une session absente
ouvre la connexion Email en conservant cette destination. Le rôle `super_admin`
est vérifié en base avant de refuser un contexte d’établissement mémorisé ou
introuvable : un compte plateforme n’est pas rattaché à un établissement.
Le cas d’un ancien `rp_tenant_slug` a reproduit une déconnexion immédiate après
authentification ; ce contrôle ne doit pas précéder la vérification du rôle plateforme.

## 1. Créer les comptes et la base

- Créer un compte sur https://supabase.com/dashboard et un projet **vide** RectorPlus.
- Créer un compte sur https://vercel.com/signup.
- Conserver le mot de passe de la base et les clés secrètes dans vos outils sécurisés.
  Ne jamais les envoyer dans le chat ou les ajouter à Git.

Dans le dossier du projet, avec Node 22 ou supérieur :

```sh
npm ci
npx supabase login
npx supabase link --project-ref IDENTIFIANT_DU_PROJET
npx supabase db push
npx supabase functions deploy
```

Vérifier le projet cible avant `db push`. Les neuf migrations reconstruisent le schéma
sur ce nouveau projet ; elles ne sont pas une migration de données d’un ancien service.
La CLI demande votre connexion à Supabase ; aucun identifiant n’est fourni par le code.

## 2. Déployer le web

Le fichier `vercel.json` configure Vite et les liens directs `/e/mon-ecole`, `/login`,
`/super-admin` et les autres routes.
Le build hébergé refuse de démarrer avec une configuration factice ou une clé `service_role`.

Avec l’interface Vercel : importer le dépôt et définir pour l’environnement choisi :

```text
VITE_SUPABASE_URL = URL HTTPS du projet Supabase
VITE_SUPABASE_PUBLISHABLE_KEY = clé publique / publishable du projet
```

On peut aussi utiliser la CLI sans intégration Git :

```sh
npx vercel login
npx vercel link
npx vercel env add VITE_SUPABASE_URL production
npx vercel env add VITE_SUPABASE_PUBLISHABLE_KEY production
npx vercel --prod
```

La configuration d’upload exclut les outils locaux, Android et les fichiers `.env`.
Les déploiements ont lieu dans votre compte. Choisir le plan et vérifier ses conditions
dans les services ; le projet ne souscrit aucun abonnement automatiquement.

## 3. Configurer les emails et les fonctions

Dans Supabase Auth :

- Désactiver l’inscription libre : les comptes réels sont créés par l’administration.
- Définir **Site URL** sur l’URL HTTPS réellement fournie par Vercel.
- Autoriser l’URL `https://VOTRE-SITE/reset-password` dans les redirections.
- Configurer un SMTP pour envoyer les liens aux responsables d’établissement.

Le SMTP intégré de Supabase limite les destinataires aux membres du projet. Pour les
essais avec d’autres adresses, configurer un fournisseur SMTP :
[documentation officielle](https://supabase.com/docs/guides/auth/auth-smtp).

Créer `supabase/functions/.env` depuis l’exemple, avec :

```dotenv
PUBLIC_APP_URL=https://VOTRE-SITE
ALLOWED_ORIGINS=https://VOTRE-SITE,https://localhost
```

Puis :

```sh
npx supabase secrets set --env-file supabase/functions/.env
```

Ajouter les origines locales exactes si vous testez le frontend local sur la base distante.
Les clés serveur Supabase sont fournies à l’Edge Runtime par Supabase ; elles ne doivent
jamais être copiées dans les variables Vite.
Le gestionnaire vérifie le JWT avec `getUser(token)` et les rôles côté serveur pour
les fonctions privées. Les demandes initiales et la récupération de compte sont publiques
avec validation et limitation de fréquence.

## 4. Créer le premier super administrateur

Utiliser le script `npm run backend:bootstrap` décrit dans [BACKEND.md](BACKEND.md).
Fournir ses variables dans un terminal personnel. Utiliser un mot de passe fort et
une adresse réelle sous votre contrôle. Le script ne crée aucun compte de démonstration caché.

Se connecter sur `/login`, onglet **Email**. Le rôle serveur redirige vers `/super-admin`.

## 5. Tester le parcours réel

1. Sur `/preinscription`, déposer un dossier d’établissement avec une autre adresse
   de test sous votre contrôle et des documents de test sans données sensibles.
2. Dans un autre navigateur, ouvrir le super administrateur : le compteur des demandes
   et la liste des préinscriptions doivent se mettre à jour via Realtime.
3. Approuver le dossier : une transaction crée l’établissement, rattache le compte
   administrateur et démarre un essai de **14 jours**, sans prélèvement automatique.
   Si la création Auth a réussi mais que la transaction échoue, le compte reste sans
   établissement ni rôle administrateur ; une nouvelle tentative reprend ce même
   compte marqué par la demande. Deux validations concurrentes ne créent pas deux établissements.
4. Le responsable reçoit un lien pour choisir son mot de passe, puis se connecte sur
   le lien `/e/identifiant`. Aucun mot de passe temporaire n’est affiché au super admin.
5. Depuis cet établissement, créer des élèves, professeurs ou parents avec les outils
   d’administration. Les comptes ne sont pas créés par la démonstration `/apercu`.
6. Depuis `/super-admin/subscriptions`, modifier le plan, le montant ou l’échéance,
   renouveler ou suspendre. La suspension est contrôlée en base, et pas seulement par l’interface.
7. Garder deux sessions ouvertes pour vérifier l’arrivée des modifications : navigateur
   établissement et navigateur super administrateur. Répéter ensuite sur Android.

Les tests SQL locaux vérifient les autorisations, l’approbation unique, le rattachement
du compte, l’essai et la suspension/renouvellement. Les essais cloud ci-dessus restent
indispensables pour vérifier Auth, SMTP, Storage et les WebSockets sur les services réels.

## Android et mises à jour

Le dossier `android/` existe. Aucun APK n’a encore été compilé ni testé sur appareil.
Le workflow `.github/workflows/android-test.yml` peut produire l’APK de test dans les
artifacts GitHub Actions après mise du projet dans un dépôt et configuration des variables :

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
RECTORPLUS_WEB_URL
```

Deux modes sont distingués :

- **APK avec interface embarquée** (défaut) : la base et les données sont communes au
  web et à l’APK. Les mises à jour de notes, comptes et abonnements passent par Realtime.
  Les changements du code embarqué demandent un nouveau binaire, ou un service OTA
  signé à intégrer séparément. Aucun service OTA n’est connecté à cette version.
- **APK de test avec interface distante** : dans le workflow, activer `live_preview`.
  Il charge le site HTTPS hébergé, pour essayer les modifications d’interface sans
  reconstruire l’APK. Ce mode est explicitement réservé aux tests, pas à la distribution
  en boutique. Il nécessite Internet et un domaine stable sous votre contrôle.

Le second mode peut être préparé localement avec `CAPACITOR_TEST_MODE=1` et
`CAPACITOR_TEST_URL=https://VOTRE-SITE` avant `cap sync android`.
Supprimer ces variables et synchroniser à nouveau pour revenir au binaire embarqué.
L’APK debug utilise le suffixe `.debug` et ne constitue pas une release signée de production.

Sur le web, une nouvelle version publiée est détectée en une minute environ lorsque
la page est active. Un bouton propose l’actualisation pour ne pas perdre une saisie.
Le même mécanisme s’applique au mode Android de test distant. Les changements de
données et ceux du code ne sont donc pas confondus.

Références : [Vite sur Vercel](https://vercel.com/docs/frameworks/frontend/vite),
[Supabase Realtime](https://supabase.com/docs/guides/realtime/postgres-changes),
[configuration Capacitor](https://capacitorjs.com/docs/config).
