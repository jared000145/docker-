# Validation RectorPlus — interface 1.1.1

Publication : https://rectorplus.vercel.app
Déploiement : `dpl_5SMFPvkkrqbvxrHzwcVjX2aMmrEH`, Ready, 10 novembre 2026.
Le domaine personnalisé reste détaché.

Cette version complète la version 1.1.0 décrite dans `VALIDATION_1_1_0.md`.
La recherche de destinataires interroge le serveur avec le texte recherché, au-delà
des 100 contacts initiaux. Les diffusions utilisent leur propre liste exhaustive
dans le périmètre autorisé, avec une limite explicite de 5 000 destinataires.
Chaque agent dispose de son historique d'envoi, limité aux 200 derniers éléments
de l'année et du campus consultés. L'identité de l'expéditeur est imposée par la
base ; le destinataire peut marquer une notification lue sans réécrire son contenu.

## Contrôles

- 74 tests web réussis sur 18 fichiers ; contrôle TypeScript réussi.
- Suite PostgreSQL embarquée réussie avec toutes les migrations, y compris les
  recherches au-delà des 100 contacts, l'historique et les droits des notifications.
- Migration `202611100018_notification_delivery_history.sql` appliquée sur Supabase.
- Compilation de production réussie ; déploiement Vercel Ready.
- Signatures APK et AAB vérifiées ; empreintes des fichiers et manifestes vérifiées.
- Sur l'adresse publique : HTTP 200, signature RSA du manifeste et SHA-256 du paquet
  vérifiées, téléchargement de l'APK vérifié, aucun renvoi au domaine personnalisé.
- Essais sur la version publique et la vraie base réussis : isolation des campus,
  accès global explicite, masquage financier, redoublement futur, candidature et
  dossier privé, décision universitaire, confirmation de paiement, messagerie sur
  ordinateur et téléphone, planning, synthèse des campus, modèle Excel, ancienne
  classe avec ses notes, blocage ANBG et recherche/envoi/historique de notification.
  Aucun incident JavaScript non intercepté. Les huit comptes et deux établissements
  temporaires ont été supprimés après contrôle de leurs marqueurs ; les comptes
  réels n'ont pas été modifiés. Journal : `.tools/postbac-patch-published-qa.log`.

## Paquet mobile

Interface **1.1.1**, build **3**, contrat natif **1**, compatible avec l'APK **1.0.0**.
Paquet signé : 4 752 289 octets, 300 fichiers web.
SHA-256 : `d7884f14759842676e4587ca1cb1eba65348214b95cd81ffd4f56cd56061b110`.

Le paquet est téléchargé puis activé au redémarrage de l'application. La réception
sur un téléphone physique n'a pas été certifiée par ces contrôles réseau.
La publication effective sur Google Play reste à réaliser ; aucun compte Play
Developer n'est configuré ici.

## Limites fonctionnelles assumées

Recommandations explicables sans API IA payante ; frais visibles et paiement sur
place confirmé par un agent autorisé. L'ANBG reste indépendante : vérification
manuelle d'une décision officielle, sans API ANBG ni attribution de bourse par
RectorPlus. Les pièces de candidature sont privées et vérifiées par l'université ;
aucun contrôle automatisé d'authenticité documentaire n'est configuré.
