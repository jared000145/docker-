# Identifiants et mots de passe — interface 1.2.1

Publication : https://rectorplus.vercel.app, déploiement
`dpl_HMXaa4JF52k9B2ScMDBhzB9oon21` (Ready), 10 novembre 2026.

92 tests web réussis sur 23 fichiers ; TypeScript, tests PostgreSQL et fonctions
serveur vérifiés. La migration `202611100025_registration_numbers.sql` et les
fonctions de création/modification de comptes ont été déployées sur Supabase.
Interface mobile 1.2.1, build 8, compatible avec l'APK 1.0.0 ; paquet signé.

Le mot de passe initial par défaut est **123456** pour les comptes créés par
l'administration : élèves/étudiants, professeurs, parents et membres de l'équipe,
y compris les nouveaux administrateurs. Un mot de passe fourni explicitement dans
le formulaire reste utilisable. Les imports créant réellement un compte emploient
aussi ce mot de passe initial ; une reprise d'import ne remet jamais le mot de
passe d'un compte existant à sa valeur initiale.

Un compte utilisant le mot de passe initial doit choisir son mot de passe
personnel à la première connexion. Une réinitialisation administrative invite
également son destinataire à choisir un mot de passe personnel. Le changement
personnel est disponible dans **Mon compte** pour chaque rôle. Il accepte entre
6 et 128 caractères et refuse de reprendre le mot de passe initial. Après une
modification, une nouvelle connexion peut être nécessaire selon la session Auth.

La correction distingue deux opérations : chacun peut modifier son propre mot de
passe sans être administrateur principal ; seuls les responsables autorisés peuvent
réinitialiser celui d'un autre compte de leur établissement. Les super administrateurs
conservent leur périmètre spécifique. Les autres membres et les comptes d'un autre
établissement sont refusés. Les métadonnées Auth existantes sont préservées.

Les matricules automatiques suivent la forme **ÉTABLISSEMENT-INITIALES-ANNÉE-NUMÉRO**,
par exemple `UOB-JPN-2026-0001` pour Université Omar Bongo, Jean-Pierre Nguéma.
Les accents et mots de liaison sont normalisés. L'année est l'année civile de
l'inscription initiale ; le matricule ne change pas lors d'un passage de classe,
d'un redoublement ou d'un changement d'année scolaire. Le suffixe est attribué par
la base, avec unicité et réservation stable lors d'une reprise d'import.

Les mots de passe et matricules déjà attribués ne sont pas modifiés par cette
évolution. Les imports qui fournissent explicitement un ancien matricule le
conservent ; une cellule vide déclenche le nouveau format automatique.

## Vérifications

Tests SQL : attribution réservée au serveur, initiales, année, unicité,
réservation idempotente et refus de réutilisation entre établissements.
Tests des fonctions et du web : modification personnelle par un membre non
principal, périmètre des réinitialisations, préservation des métadonnées, mot de
passe initial et absence de réinitialisation lors d'une reprise d'import.

Essais sur la vraie base avec huit comptes temporaires et deux établissements :
connexions initiales des quatre rôles, homonymes avec numéros distincts, changement
de mot de passe depuis l'interface d'un membre non principal, reconnexion avec le
nouveau mot de passe, refus de l'ancien, réinitialisation administrative, refus
entre établissements et reprise d'import. Les données temporaires ont été supprimées ;
aucun compte réel n'a été changé.

La même série a réussi sur la version publiée 1.2.1, sans incident JavaScript.
Huit comptes et deux établissements temporaires ont été supprimés après contrôle
de leurs marqueurs. Journaux : `.tools/credentials-published-qa.log` et
`.tools/credentials-published-release.log`. Signature mobile et paquet vérifiés.
