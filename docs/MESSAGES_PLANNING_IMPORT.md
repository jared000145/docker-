# Messagerie, planning et import des étudiants

Lot demandé par le propriétaire, publié progressivement sur rectorplus.com.

## Accès dans l'administration d'un établissement

- **Tableau de bord** : aperçu des messages reçus/envoyés et des contacts de
  l'administration ou des étudiants, avec leurs photos disponibles.
- **Messagerie** : menu Communication ; destinataire individuel, objet, message,
  historique reçu/envoyé et accès direct depuis une personne du tableau de bord.
- **Planning** : grille hebdomadaire avec relief activable, heures à la minute,
  événements simultanés dans des colonnes distinctes, agenda sur téléphone.
- **Étudiants → Importer Excel** : modèle, aperçu, vérification des lignes et
  création automatique. Le même import est aussi accessible dans les paramètres.

Les initiales remplacent une photo absente. Aucun portrait artificiel n'est
attribué à un utilisateur. Les captures dans `docs/previews/` utilisent des
données fictives et ne représentent pas les établissements de production.

## Causes corrigées

La page de messagerie existait sans route. L'ancien import étudiants appelait
`import-scolarplus`, fonction absente du backend reconstruit. L'ancien planning
ne montrait que le premier événement d'une cellule et arrondissait sa durée
à l'heure. Les événements simultanés et les débuts à la demi-heure pouvaient
donc être masqués ou mal positionnés.

La nouvelle route `/admin/messages` est protégée. Les requêtes utilisent
l'établissement et les participants. Les aperçus du tableau de bord ne marquent
pas les messages comme lus. Les libellés et avatars sont résolus pour les
correspondants, y compris les autres membres de l'administration.

La migration additive `202611090003_message_defaults.sql` renseigne
`institution_id` depuis le profil de l'expéditeur lorsqu'un ancien client omet
ce champ. Les politiques RLS des participants et de l'établissement sont
conservées. Deux index couvrent les historiques récents.

## Import sécurisé et reprise

La fonction `import-student` requiert un administrateur principal authentifié,
un établissement actif et un abonnement permettant les inscriptions. Elle
vérifie l'année active et les références de filière/classe avant création Auth.
Le rôle attribué est toujours étudiant, indépendamment des champs du fichier.

Formats : XLSX, XLS, CSV ; 5 Mo et 500 lignes maximum, première feuille, en-têtes
sur la première ligne. Noms, prénoms, niveaux, dates, année, références et
doublons sont contrôlés. Les écritures collège « 6ème » et « 6e » sont rapprochées.
Les zéros de matricules formatés dans Excel sont conservés. Les cellules de
formule sont refusées dans les colonnes utilisées.

Une clé de reprise stable est calculée pour chaque ligne du même fichier. Les
comptes Auth portent une marque serveur avec l'établissement et l'empreinte de
la ligne. Une relance identique conserve le compte sans doublon ni changement
de mot de passe. Une inscription partielle peut être reprise. Un matricule déjà
utilisé par une autre importation est refusé ; aucun compte n'est écrasé.

Les matricules vides sont générés. Un homonyme déjà présent nécessite une
vérification et un matricule explicite plutôt qu'une fusion automatique.
Les mots de passe initiaux sont générés côté serveur et peuvent être téléchargés
en Excel dans la session de création. Ils ne sont pas enregistrés en clair dans
le navigateur. Si la réponse initiale est perdue, régénérer le mot de passe
depuis la fiche après la reprise du compte.

Le modèle inscrit les étudiants pour l'année active. Il ne reprend pas leurs
notes, paiements, dettes ou années historiques. Les filières et classes doivent
exister avant importation. Les anciens imports historiques restent un chantier
séparé ; leur présence dans le code n'en prouve pas le fonctionnement.

Le lecteur Excel est passé à SheetJS 0.20.3, archive officielle conservée dans
`vendor/` pour permettre des builds reproductibles :
[installation officielle SheetJS](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/).
SHA-256 de l'archive :
`8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8`.

## Horaires et séries

Le fuseau existant Africa/Libreville (UTC+1) est explicite et partagé entre
saisie, stockage, édition et affichage. Les vues étudiant/enseignant réutilisent
la grille ; les modèles scolaires restent des modèles hebdomadaires, distincts
des occurrences datées. Les jours de fin de semaine et séances traversant une
limite de semaine ne sont plus exclus de la grille datée.

La modification/suppression d'un créneau récurrent utilise sa série, sa classe,
sa filière et son niveau. Une séance isolée ne modifie pas les autres cours de
la même matière. Les exports PDF existants sont conservés ; ce lot ne certifie
pas une refonte complète de tous les exports.

## Validation et sauvegarde

- Source avant changements :
  `.tools/snapshots/messages-planning-import-avant-20261109.zip`.
- Base capturée en lecture seule et chiffrée avant migration :
  `.tools/backups/2026-11-09T09-33-42.135Z/`.
- Suite complète de 62 tests réussie ; après le dernier correctif de portée des
  séries, les 11 tests du planning et TypeScript ont de nouveau réussi
  (63 scénarios distincts au total).
- Treize migrations testées localement, avec tests de réception/réponse,
  usurpation d'expéditeur, modification interdite et isolation des établissements.
- Gardes des fonctions serveur réussies.
- Navigateur isolé : reçus/envoyés, contacts, envoi, planning en relief,
  chevauchements, mobile et import de deux lignes valides avec exclusion d'une
  ligne invalide ; aucune erreur JavaScript dans ce parcours.
- Supabase réel : création de deux étudiants de test, reprise sans doublon,
  contrôle des rôles, année, références, messages et photo privée. Les comptes
  réels ne sont pas modifiés et les données QA sont retirées après essai.

La fonction d'import et la migration sont déployées séparément du frontend.
Le lot ne produit pas de nouvelle APK et ne configure aucun envoi d'email.

## Vérification finale sur le domaine public

Déploiement Vercel `dpl_3QL8dFGzgE4exgG74vw74X2vd5Er`, publié sur
https://rectorplus.com.

Le parcours navigateur sur le vrai site a validé le tableau de bord, la photo
privée d'un étudiant, l'envoi d'un message, le planning et la création d'un
compte étudiant depuis un fichier Excel. Aucune erreur JavaScript relevée dans
ce parcours. Trois comptes étudiants de test ont été créés au total ; la
connexion avec le mot de passe initial et la réimportation sans doublon ont
également été vérifiées. Toutes les données de cet essai ont été supprimées ;
les comptes utilisateurs existants sont restés intacts.