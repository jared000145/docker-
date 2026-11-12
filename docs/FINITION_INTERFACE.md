# Finition des espaces connectés — 9 novembre 2026

Publié sur rectorplus.com après la demande de terminer l'adaptation aux images.

## Rendu commun

La charte commune couvre les espaces administrateur, super administrateur,
étudiant, enseignant, parent, direction et validation : navigation bleu nuit,
sélection bleue, cartes blanches, typographie Inter dans les espaces connectés,
en-têtes de tableaux clairs, bordures discrètes et focus clavier visibles.
Les fonctionnalités et droits propres aux rôles sont conservés.

Les paramètres académiques disposent d'une navigation vers leurs sections
réelles (validation, moyennes/crédits, absences, règles scolaires selon le cycle),
du sélecteur d'année et d'une grille adaptée au mobile. Les champs fictifs des
images ne sont pas ajoutés en tant que commandes non opérationnelles.

## Tableau de bord administrateur

Ajout des présences, des cinq absences récentes avec identité/photo autorisée,
matière et état du justificatif, ainsi que des cinq activités récentes du journal.
Les requêtes sont limitées à l'établissement et, pour l'assiduité, à l'année
sélectionnée. Les absences justifiées restent comptées comme des absences.
Le pourcentage porte sur les pointages présent/absent/justifié, pas sur les
heures de cours prévues ; un établissement sans pointage affiche « — ».

Les blocs présences et audit ne sont demandés que pour les modules autorisés.
Un échec est affiché comme une indisponibilité, sans pourcentage inventé.
Le graphique financier vide est remplacé par un message explicite.

La migration additive `202611090002_dashboard_realtime.sql` ajoute attendance
et audit_logs à la publication existante ; leurs politiques RLS sont conservées.
Les nouveaux blocs ont aussi un rafraîchissement périodique de secours.

## Super administration

Quatre indicateurs, dont les dossiers en attente, et un tableau des établissements.
Les cartes établissements et administrateurs ouvrent maintenant leurs vraies
pages de gestion. Les cartes sont accessibles au clavier.

## Vérifications

- 40 tests applicatifs réussis, dont cinq sur les nouveaux blocs du tableau de bord.
- TypeScript réussi et compilation Vercel réussie.
- Douze migrations exécutées dans les tests SQL locaux ; isolation et stockage
  privé vérifiés.
- Captures ordinateur/mobile avec données fictives ; aucun débordement
  horizontal à 390 px ni erreur JavaScript dans le parcours testé.
- Page compte publiée et maintien de l'accès super administrateur après reload
  vérifiés sur le domaine.
- Correctif ultérieur des absences justifiées : cinq tests ciblés et TypeScript
  réussis avant publication.

Dernier déploiement de cette finition : `dpl_6BScYnJYM1SqQGbHQNvJoxSXt6DF`, READY.
Les captures dans `docs/previews/` servent d'illustration et ne constituent pas
des données d'établissement réelles. La matrice complète de tous les parcours
métier n'est pas assimilée à ces contrôles visuels.

La préparation des sauvegardes locales suit ce lot ; voir
`SAUVEGARDES_LOCALES.md` pour ses résultats et limites distincts.
