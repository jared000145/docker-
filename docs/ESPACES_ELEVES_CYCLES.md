# Espaces élève — interface 1.1.4

Publication : https://rectorplus.vercel.app, déploiement
`dpl_DYuocLy75yKWVgZ3fpGNfix6XpUS` (Ready), 10 novembre 2026.

Les pages Tableau de bord, Mes notes et Mes cours utilisent l'inscription
individuelle de l'année consultée. Un établissement qui propose collège, lycée
et université n'envoie donc plus tous ses utilisateurs vers les écrans LMD.

- Collège et lycée : tableau de bord scolaire, notes trimestrielles et matières
  de la classe. Les menus de cursus LMD, soutenance et BDE ne sont pas proposés.
- Université : les écrans et menus universitaires sont conservés.
- Historique : les cours du collège et du lycée utilisent la classe de l'année
  choisie, avec ses affectations de matières. Ils ne reprennent plus la classe
  actuelle du profil pour afficher une ancienne année.
- Inscription historique absente : un message explicite remplace un écran
  universitaire inadapté ; le sélecteur d'année reste accessible.

La sélection d'un cycle n'ajoute aucun droit à la base. Les données restent
soumises aux politiques d'accès existantes. L'orientation post-bac conserve sa
condition Terminale ou post-bac et ne s'affiche pas pour un collégien.

## Vérification

82 tests web réussis sur 20 fichiers, dont cinq nouveaux cas couvrant les
établissements mixtes, les anciennes inscriptions, l'absence de substitution de
la classe actuelle et la conservation du parcours universitaire. TypeScript et
compilation de production vérifiés.

Essais locaux avec la vraie base et des comptes temporaires : collège et lycée
dans un établissement mixte, tableau de bord scolaire, notes trimestrielles,
matières et notes d'une ancienne classe, menus et rendu mobile sans débordement,
maintien des cours universitaires. Aucun incident JavaScript non intercepté.
Les huit comptes et deux établissements temporaires ont été supprimés et les
comptes réels n'ont pas été modifiés. Journal : `.tools/student-cycles-local-qa.log`.

Interface mobile 1.1.4, build 6, compatible avec l'APK Android 1.0.0. Le paquet est
signé et activé par le mécanisme de mise à jour existant ; aucune publication
Google Play n'est effectuée par cette évolution.

Paquet : 4 754 102 octets ; SHA-256
`2c92331ee2481e3d8c0a3541c35a201361963e9892bfdc31fb7a28fb2b9a91fa`.

Les essais des parcours ont également réussi sur la version publiée, sans incident
JavaScript non intercepté. Le manifeste RSA, l'empreinte du paquet, sa compatibilité
native et le téléchargement APK ont été contrôlés depuis l'adresse publique.
Journaux : `.tools/student-cycles-published-qa.log` et
`.tools/student-cycles-published-release.log`.
