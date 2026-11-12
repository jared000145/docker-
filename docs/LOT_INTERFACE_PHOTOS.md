# Lot local : interface et photos — 9 novembre 2026

## Livré

- Cadre commun aux sept espaces : navigation bleu nuit, liens actifs bleus,
  cartes claires, en-tête et menu de compte cohérents.
- Tableau de bord administrateur et grille des paramètres académiques adaptés
  aux références, sans recopier leurs chiffres ni inventer de fonctions métier.
- Page `/account` accessible à chaque rôle connecté et éditeur de photo partagé
  avec les paramètres existants : choix, recadrage, zoom et aperçu.
- Contrôle du format réel JPEG/PNG/WebP, limite de 5 Mo, réencodage avant envoi.
- Mise à jour immédiate de la photo du compte. L'ancienne photo est conservée
  si la sauvegarde échoue ; le nouveau fichier orphelin est alors supprimé.

## Stockage et état de publication

La migration additive `supabase/migrations/202611090001_profile_photos.sql`
prépare un bucket privé et des règles d'accès. Les nouvelles références de photo
utilisent des URL signées temporaires. Les anciennes photos restent compatibles ;
aucune migration de leurs fichiers publics n'a été effectuée.

Le propriétaire a autorisé la suite par « continue ». La migration a été appliquée
en production le 9 novembre 2026. Un essai réel authentifié a confirmé l'envoi,
la lecture par URL signée, le refus de lecture anonyme et le refus du type texte.
Le fichier temporaire a été supprimé et le profil existant n'a pas été modifié.
Le déploiement Vercel `dpl_DLkrpBRLvDXkyeEHdNfk8Cmdt6D8` est READY et associé à
`https://rectorplus.com`.
Ni la facturation ni l'APK ne sont modifiées par ce lot.

## Vérification

- TypeScript : vérification réussie.
- Vitest : 30 tests réussis, dont formats, cadrage et actualisation du profil.
- Tests SQL locaux : accès propriétaire et isolation entre établissements.
- Navigateur local : sauvegarde, affichage de l'image signée, refus d'un faux
  fichier image, conservation après échec, absence d'erreur JavaScript et de
  débordement horizontal à 390 px.
- Captures dans `docs/previews/` : données fictives et image de test uniquement.

Sauvegarde des sources avant modification :
`.tools/snapshots/interface-avant-20261109-090719.zip`.
La configuration des buckets et des politiques avant migration est sauvegardée
dans `.tools/snapshots/storage-*-before-20261109.json`.

## Domaine

Les quatre serveurs faisant autorité IONOS ainsi que Google (8.8.8.8) et
Cloudflare (1.1.1.1) renvoient `216.198.79.1`. Le résolveur par défaut du réseau
local renvoie encore temporairement `185.158.133.1`, même après nettoyage du
cache Windows. Ne pas confondre ce cache avec la configuration faisant autorité.
La destination Vercel sert correctement le domaine en HTTPS.
