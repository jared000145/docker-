# Validation RectorPlus — interface 1.1.0

Publication : https://rectorplus.vercel.app
Déploiement Vercel : `dpl_GPnk9PszFoRpKAQaCbEzsWusMVvF`, statut Ready.
Le domaine personnalisé n’a pas été rattaché.

## Contrôles réalisés

- 74 tests web réussis, contrôle TypeScript et compilation réussis.
- Toutes les migrations exécutées dans PostgreSQL embarqué avec les tests métier
  et de permissions, puis 17 migrations additionnelles appliquées sur Supabase.
- Essais sur la vraie base, d’abord depuis l’interface locale puis sur la version publiée :
  périmètres de campus, accès transversal explicite, masquage des finances,
  inscription future d’un redoublant, dossier de candidature privé,
  décision d’admission, paiement sur place, messagerie ordinateur/mobile,
  modèle Excel, ancienne classe avec ses notes et contrôle d’orientation ANBG.
- Aucun incident JavaScript non intercepté sur ces parcours.
- Les huit comptes et les deux établissements temporaires de la dernière série
  ont été supprimés après vérification de leurs marqueurs de test. Aucun compte réel
  n’a été modifié pour ces essais.
- Planning contrôlé sur ordinateur et téléphone : semaine usuelle de six jours,
  conservation du dimanche lorsqu’il contient des séances, largeur des séances
  simultanées, filtres par classe et absence de débordement horizontal du téléphone.
- Téléchargement public de l’APK vérifié, empreinte identique au fichier signé.

## Android

Application native : 1.0.0, code 1. Interface : 1.1.0, build 2, contrat natif 1.
Manifeste stable public vérifié par sa signature RSA ; paquet de 4 752 205 octets,
300 fichiers, empreinte SHA-256 :
`36e6a719270eea8280cafc9b9d30d3a5e3a5911323d06744527b7510c4372074`.
Le manifeste est servi sans cache ; les fichiers sont préparés ensemble avant activation.
L’APK 1.0.0 déjà livrée reste compatible avec ce paquet. L’AAB et l’APK ont conservé
leurs signatures. Cette publication ne vaut pas publication sur Google Play.

## Sauvegarde et limites

Une capture cohérente chiffrée a été créée avant les migrations dans
`.tools/backups/2026-11-09T23-40-46.439Z` : 148 tables à la capture. Elle reste locale,
sans copie indépendante et sans validation de restauration complète supplémentaire.

Les suggestions sont calculées, sans API d’IA payante. Aucun prestataire de paiement
en ligne n’est configuré. La voie ANBG exige un justificatif contrôlé ; aucun flux
automatique officiel ANBG n’est connecté. L’examen du contenu des documents d’admission
reste à effectuer par l’université. Les essais sur navigateur ne remplacent pas un essai
de mise à jour de bout en bout sur un téléphone physique.

Guide utilisateur : [Multicampus et post-bac](MULTICAMPUS_POSTBAC.md).
