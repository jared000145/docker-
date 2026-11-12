# RectorPlus — interface 1.2.0

La vérification finale sur le site publié a réussi : droits financiers,
messagerie intercampus, maintien de l'isolation des élèves, drapeaux, exports
signés scolaire/université, résumés publics, révocation et carte avec photo.
Aucun incident JavaScript non intercepté ; huit comptes et deux établissements
temporaires supprimés. Les QR des PDF téléchargés depuis le site publié ont
été décodés et comparés aux références émises. Journaux :
`.tools/campus-final-published-qa.log`, `.tools/pdf-published-qr-verification.log`.

Site : https://rectorplus.vercel.app. Déploiement Vercel
`dpl_9AxuNu9ew1i7u1B6Kx5Gbd3UKEPz`, statut Ready, 10 novembre 2026.
87 tests web réussis sur 22 fichiers ; contrôle TypeScript et compilation réussis.
Migrations 202611100021 à 202611100024 appliquées sur Supabase.
Manifeste RSA et empreinte du paquet vérifiés depuis le site publié.
Paquet de 4 877 593 octets ; SHA-256 :
`caa224b5ab351bd63822e7de003c3906682a4af85d2afe3bd6c94dcd987abc2f`.

## Responsabilités multicampus

Dans Paramètres → Établissement → gestion des campus, affecter chaque membre aux
campus qu'il gère. La section Responsabilités et visibilité permet au propriétaire
d'accorder séparément la vue de tous les campus et la synthèse financière.
Ces changements sont journalisés. Le tableau de bord et la messagerie sont ajoutés
aux membres configurés ; les autres droits de leur rôle restent en place.

La direction globale peut consulter l'effectif, les encaissements, les dépenses
saisies et le solde de trésorerie de chaque campus autorisé et de l'ensemble
affiché. Les gestionnaires affectés restent limités à leurs sites. Le solde ne
constitue pas un bénéfice comptable. Un périmètre pédagogique limité conserve les
restrictions financières existantes. La synthèse prend aussi en compte les anciens
reçus marqués payés dont le montant encaissé n'avait pas été renseigné.

La messagerie retrouve les collègues administratifs des autres campus de la même
institution, affiche leur campus et autorise une conversation privée. Ce droit de
communication ne donne pas accès aux profils, notes ou paiements des élèves des
autres sites. Les élèves d'autres établissements restent exclus.

## Interface et pays

La charte partagée harmonise les surfaces, cartes, boutons, formulaires, onglets,
tableaux et navigation des espaces existants, avec une palette bleu nuit, bleu et
cyan, et des états de chargement explicites. Les écrans campus, carte numérique et
vérification disposent de compositions dédiées. Les modèles de PDF restent séparés
des styles de l'application.

Les drapeaux des pays sont des SVG locaux : leur affichage ne dépend plus des
emojis du système. Le téléphone conserve le pays choisi lorsqu'un indicatif est
partagé, comme +1 pour le Canada et les États-Unis. Les listes comprennent les
pays et territoires du référentiel embarqué. Licences dans `public/flags`.

## Carte numérique

La carte présente la photo privée du profil, le nom, le matricule, la classe ou le
niveau, l'année et l'établissement. La photo est résolue par une URL temporaire
autorisée. Elle peut être ajoutée depuis les paramètres du profil.

Le QR est généré localement, sans service tiers et sans lien de connexion
automatique. Il ouvre une confirmation d'inscription. Le statut est actif seulement
pour l'année active et une inscription accessible ; les notes, dettes et photos
privées ne sont pas exposées dans cette confirmation publique.

## Vérification des bulletins et relevés

Les PDF officiels conservent leur structure : bulletin trimestriel scolaire et
relevés universitaires par semestre. Les défauts de contraste, le chevauchement
du QR sur une signature et le doublon de pied de page ont été corrigés.

Chaque étudiant reçoit une référence aléatoire propre à sa version validée. Le QR
ouvre `/verify/releve/<référence>` sur le site public, même pour un export Android.
Une connexion n'est pas demandée. La page présente l'établissement, l'identité
utile, l'année, la période et le résumé des résultats ; elle n'expose ni les autres
élèves de la classe, ni les coordonnées personnelles, ni le PDF collectif.

Seule une version ayant terminé les trois signatures peut recevoir une référence.
Les résultats proviennent des notes et paramètres figés avec cette version. Les
quatre modes de calcul universitaire sont testés ; la page et le PDF emploient la
même synthèse. Une réouverture ou un retrait invalide immédiatement la confirmation.
Une panne réseau est distinguée d'une référence inconnue. La confirmation permet
de comparer le document présenté à son enregistrement ; elle ne constitue pas une
signature cryptographique du fichier PDF lui-même.

Les anciens PDF utilisant un ancien QR doivent être réédités depuis le document
validé pour recevoir la nouvelle référence. Les aperçus non validés ne portent pas
de QR déclarant une authenticité.

## Validation et Android

Tests PostgreSQL : isolation des campus et établissements, autorisations
financières explicites, communication entre collègues, maintien des restrictions
sur les élèves, refus de référence pour un document non signé, résumé anonyme,
révocation et statut des cartes. Tests web : formulaires, référentiel des pays,
états publics et parcours existants.

Essais avec la vraie base et des données temporaires : messagerie entre campus,
drapeaux SVG, export des deux PDF signés, résumé sans connexion, retrait d'un
document, photo privée sur carte et rendu mobile. Les données temporaires sont
supprimées en fin de série. Les QR imprimés sur chaque page sont décodés après
rendu PDF et leur hôte et leur référence sont contrôlés.

Interface mobile **1.2.0**, build **7**, contrat natif **1**, compatible avec l'APK
**1.0.0**. Le paquet est signé ; son activation passe par le mécanisme de mise à
jour existant. Aucune publication Google Play n'est effectuée par cette évolution.
