# Sauvegarde locale et restauration isolée

Première étape autorisée par le propriétaire : préparer sur cet ordinateur,
avant de choisir une copie externe. Aucun abonnement ou stockage externe n'est créé.

## Ce qui est préparé

`npm run backup:local` ouvre un instantané PostgreSQL en lecture seule. Les
comptages et `pg_dump` utilisent le même instantané. Le fichier est chiffré en
mémoire avant écriture, avec AES-256-GCM. Les objets Storage (hors anciennes
archives du bucket `backups`) sont copiés séparément, chiffrés et hachés. Une
modification de l'inventaire Storage pendant la capture invalide la tentative.

Cette séparation est nécessaire : les sauvegardes PostgreSQL de Supabase ne
contiennent pas les octets des fichiers Storage.
[Documentation Supabase](https://supabase.com/docs/guides/platform/backups).

Les archives et la clé protégée par Windows sont dans `.tools/backups/`, exclu
de Git et de Vercel. La clé est protégée par DPAPI pour l'utilisateur Windows
courant. Sans cette clé, le déchiffrement est impossible. Cela ne remplace pas
une clé de récupération et une copie hors de cet ordinateur.

`npm run backup:verify` vérifie l'authentification cryptographique, les tailles
et SHA-256 de tous les enregistrements. Une archive incomplète est refusée.

`npm run backup:restore-check` accepte uniquement une archive locale et crée
un nouveau PostgreSQL sur une adresse de boucle locale et un port temporaire,
avec un mot de passe aléatoire. Il n'accepte aucune URL de base cible et ne
peut donc pas restaurer la production par erreur. Il compare les comptages
des tables restaurées et vérifie les octets Storage. Le serveur est arrêté
à la fin, y compris en cas d'échec. Le laboratoire est conservé dans
`.tools/restore-labs/`, protégé pour l'utilisateur Windows courant.

## Préparation de l'ordinateur

- Node et une session CLI Supabase propriétaire authentifiée.
- Client `pg` installé dans `.tools/deploy-tools/` (outillage, pas navigateur).
- Binaires PostgreSQL 17.11 portables dans `.tools/postgresql/pgsql/bin/`.
  Source : archive EDB liée depuis la
  [page officielle PostgreSQL Windows](https://www.postgresql.org/download/windows/).
- Certificat CA Supabase dans `.tools/supabase-ca.crt` ; le pilote et `pg_dump`
  vérifient le certificat et le nom du serveur. Aucun contournement TLS.
  [Documentation de la vérification SSL](https://supabase.com/docs/guides/platform/ssl-enforcement).
- Les chemins peuvent être personnalisés par `RECTORPLUS_PG_BIN` et
  `RECTORPLUS_DB_CA`. Une clé base64 de 32 octets peut être fournie via
  `RECTORPLUS_BACKUP_KEY` depuis un coffre, sans la mettre dans le code.

## Limites explicites de ce premier lot

- Pas encore de copie externe, planification, rétention ni alertes.
- La capture locale en mémoire est limitée à 256 Mo pour le dump PostgreSQL.
- Les secrets des fournisseurs/Edge ne sont pas exportés.
- Les données Auth de la base, dont les hachages de mots de passe, sont sensibles
  et incluses uniquement dans le dump chiffré. Ne jamais publier ces archives.
- Le laboratoire PostgreSQL standard ne fournit pas l'extension Supabase Vault.
  Ses instructions d'installation sont exclues de cet essai ; les données
  restent dans l'archive. L'essai ne certifie pas une restauration de toute
  l'infrastructure Supabase.
- Les propriétaires d'objets du laboratoire sont son administrateur local ;
  une restauration Supabase réelle doit rétablir les propriétaires et tester
  les rôles, Auth, Storage, Edge et les parcours applicatifs.
- La vérification des fichiers ne remplace pas leur réimport par l'API Storage
  dans un projet de test. Le premier inventaire est vide.
- La restauration sélective d'établissement n'est pas activée en production.
- Les anciens boutons web de sauvegarde/Drive restent un chantier distinct :
  leurs fonctions serveur ne sont pas encore implémentées. Ne pas les présenter
  comme une sauvegarde fiable.

L'état `captured`, le rapport d'intégrité et le rapport de restauration sont
distincts. Un message de capture réussie n'affirme pas une restauration réussie.

## Résultat réel du premier essai

Archive finale : `.tools/backups/2026-11-09T09-25-06.266Z/`.

- Capture chiffrée : réussie, 146 tables (public et schémas techniques).
- Vérification cryptographique et SHA-256 : réussie.
- Restauration applicative locale : réussie, comparaison des 146 comptages.
- Structure de sécurité : activation RLS, nombres de politiques et clés
  étrangères identiques après restauration pour les 146 tables contrôlées.
- Isolation : un administrateur de l'établissement A voit son paiement de test
  et ne voit pas celui de B. Ces fixtures sont annulées dans le laboratoire.
- Fichiers Storage à cet instant : zéro ; leur réimport réel n'est donc pas validé.
- Vault : exclu du laboratoire portable ; restauration d'infrastructure non validée.
- Le serveur du laboratoire est arrêté après l'essai ; la production n'est pas
  restaurée ni modifiée par cette procédure.

Rapports locaux : `verification.json` et `restore-check.json` dans l'archive.
Les premières tentatives incomplètes sont conservées et refusées par le
vérificateur ; elles ne sont pas présentées comme des sauvegardes validées.
