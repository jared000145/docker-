# Préinscription, contrôle documentaire et notifications

Le dépôt n’est accepté qu’après un précontrôle serveur du contenu, puis reste
soumis à une décision humaine. L’essai de 14 jours commence à la validation.
Aucun paiement ni abonnement récurrent automatique n’est créé par ce parcours.

## Activer les services

Dans les secrets Supabase, définir uniquement côté serveur :

- `OPENAI_API_KEY` : clé API d’un compte avec facturation/crédit utilisable.
- `DOCUMENT_REVIEW_MODEL` : identifiant d’un modèle Responses compatible avec
  images, PDF et Structured Outputs ; vérifier disponibilité et coût sur le compte.
- `RESEND_API_KEY` : clé d’envoi Resend.
- `MAIL_FROM` : expéditeur sur un domaine possédé et vérifié dans Resend.
- `MAIL_REPLY_TO` : une vraie boîte consultée par l’équipe, éventuellement Gmail.

Ne jamais mettre ces clés dans Vite, Git ou le chat. La page `/preinscription`
vérifie la disponibilité du précontrôle avant tout transfert. Sans service configuré,
le dépôt est fermé, avec une explication visible. Aucun résultat d’analyse n’est simulé.
Les comptes et crédits des prestataires restent à configurer par le propriétaire.

Une boîte Gmail gratuite peut servir aux réponses. Elle ne donne pas la propriété
de `rectorplus.com`. Pour des envois Resend à des tiers, vérifier son propre domaine ;
le domaine de test Resend est limité à l’adresse du propriétaire du compte.

## Contrôle documentaire

Les fichiers restent dans un bucket privé. Le serveur vérifie leur taille et leur
signature réelle, puis analyse les quatre justificatifs via Responses (`store:false`).
Le logo reçoit un contrôle de format uniquement. Aucune reconnaissance faciale ou
preuve d’authenticité n’est effectuée. Le nom d’une pièce ne suffit jamais à la valider.
Les résultats incertains, illisibles ou hors sujet bloquent le dépôt. Une photo de
caillou à la place d’un passeport doit donc être refusée par le classificateur ;
cette capacité doit encore être évaluée sur des exemples réels après configuration.

Le consentement et sa date sont enregistrés côté serveur. Le rapport contient
uniquement les statuts, une note standard, la date et le modèle ; pas de texte OCR
ni de numéro d’identité. Une limite d’analyses et un verrou par session limitent les
appels concurrents. L’examen humain reste obligatoire avant activation.

Prévoir avant ouverture à grande échelle une politique d’effacement des pièces
abandonnées/refusées et une tâche de purge des dépôts expirés ; aucune purge
automatique n’est encore planifiée par cette version.

## Deux emails distincts

1. Dossier accepté au dépôt : accusé de réception, référence, examen en cours,
   annonce d’une prochaine décision. Ce message ne vaut pas validation.
2. Décision : confirmation de validation avec essai de 14 jours, ou refus motivé.
   Le lien de choix du mot de passe passe séparément par Supabase Auth/SMTP.

Configurer aussi le SMTP personnalisé dans Supabase Auth pour les liens de mot de
passe des responsables : les secrets Edge Resend ne configurent pas automatiquement
Supabase Auth. Sans ce SMTP, les destinataires admis par le service intégré restent limités.

Les événements sont enregistrés dans `preregistration_emails` dans la transaction
de dépôt/décision. La fonction tente l’envoi après la transaction ; une panne email
n’annule pas le dossier. Sans configuration, le message reste en attente.
Le super administrateur peut consulter les états et relancer les messages.
Après un échec, attendre dix minutes avant une nouvelle tentative ; maximum cinq
tentatives. Il n’y a pas encore de tâche planifiée pour relancer automatiquement
les échecs. La clé d’idempotence Resend limite les doublons selon sa fenêtre de garantie.

L’état « transmis » signifie accepté par Resend, pas livré dans la boîte du destinataire.
Aucun webhook de livraison n’est encore branché. Les réponses arrivent dans
`MAIL_REPLY_TO` ; l’équipe répond depuis cette messagerie. Le lien « Répondre »
du dossier ouvre la messagerie avec la référence. Il ne constitue pas une boîte
de réception intégrée à RectorPlus.

## Vérifications avant ouverture

Après configuration : envoyer des exemples non sensibles (photo d’objet, document
illisible, mauvais type, puis pièces de test adaptées au pays). Vérifier l’absence
de dossier accepté pour les premiers, puis l’examen humain, l’essai et les deux emails.
Tester une vraie réponse vers `MAIL_REPLY_TO`. Les tests locaux couvrent les gardes,
les verdicts simulés et les transactions ; ils ne remplacent pas ces essais fournisseurs.
