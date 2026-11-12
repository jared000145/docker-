# Dossiers, cycles et inscriptions — version 1.1.3

Publication : https://rectorplus.vercel.app, déploiement
`dpl_7ftQ3RiuGKXvCTiShVcTeUyyELTY` (Ready), 10 novembre 2026.

Le dossier s'ouvre sur une synthèse avec l'identité, la photo du profil, l'inscription
de l'année consultée et des cartes permettant d'ouvrir les rubriques détaillées.
L'onglet Parcours conserve les inscriptions successives et permet de préparer un
passage ou un redoublement sans recopier ni écraser les anciennes notes.

## Trois parcours

- Collège : classe, niveau, responsable légal, notes et bulletins trimestriels,
  vie scolaire, finances et pièces. Aucun formulaire de bac ni crédit universitaire.
- Lycée : mêmes rubriques, avec la série. Le résultat du baccalauréat se publie dans
  Scolarité, uniquement pour une inscription de Terminale de l'année active.
- Université : formation, parcours annuel, notes, rattrapages, crédits, paiements
  et documents. Le formulaire de publication du bac n'y figure plus.

Dans un établissement mixte, la classe et le niveau de l'inscription consultée
déterminent le dossier. La liste explicite des cycles activés est respectée : un
collège n'active pas implicitement le lycée. La publication du bac est aussi
contrôlée dans la base, y compris en cas d'appel direct à l'API.

## Utilité des statuts

Les états d'inscription servent aux droits d'accès, aux attestations et à la
conservation du parcours ; ils ne sont donc pas supprimés de la base. Le menu
redondant Statuts annuels est retiré et son ancienne adresse renvoie vers
Inscriptions & accès. Cette page filtre l'année et le campus consultés et permet
d'ouvrir le dossier. La suspension d'un accès actif nécessite une confirmation ;
elle conserve les résultats et documents. Les années historiques sont en lecture
seule. Les exclusions restent traitées dans leur rubrique dédiée, et un changement
de libellé ne peut plus remplacer la procédure de redoublement dans cette page.

Les droits d'accès utilisent l'inscription de l'année active de l'établissement,
et non la dernière année créée. Une inscription préparée pour l'année suivante ne
bloque donc pas l'accès à l'année actuelle.

## Validation

77 tests web sur 19 fichiers réussis ; compilation TypeScript et production
réussies. Les migrations et tests métier PostgreSQL réussissent, notamment le refus
du bac pour un universitaire ou un collégien et le maintien de l'accès actuel en
présence d'une inscription future.

Essais avec des comptes temporaires : dossiers collège, lycée, université,
historique des notes, navigation par onglets et affichage mobile sans débordement.
Les premiers essais ont été réalisés depuis l'interface locale sur la base réelle ;
les comptes et établissements de test sont supprimés en fin de série.

La série finale locale a aussi vérifié le chargement des inscriptions, le renvoi
de l'ancienne adresse, la suspension et le rétablissement effectifs de l'accès,
et l'absence d'effet d'une inscription future sur les droits de l'année active.
Huit comptes et deux établissements temporaires ont été supprimés ; les comptes
réels n'ont pas été modifiés. Journal : `.tools/dossier-final-local-qa.log`.
La même série a ensuite réussi sur la version publique 1.1.3, sans incident
JavaScript non intercepté, avec nettoyage des huit comptes et des deux
établissements temporaires. Journal : `.tools/dossier-final-published-qa.log`.

Le chargement des inscriptions assemble les lignes annuelles et les profils
autorisés via deux lectures distinctes : aucune relation SQL inexistante n'est
supposée. Une erreur de chargement est signalée explicitement.

Interface Android 1.1.3, build 5, compatible avec l'APK 1.0.0 ; paquet signé avant
publication. Cette évolution ne constitue pas une publication sur Google Play.

Manifeste RSA et paquet SHA-256 vérifiés sur l'adresse publique.
Paquet web : 4 753 081 octets ; empreinte
`3cd942d04f4742e7981641aa490f766f59b8eeb05cfa8e238fff0dc05f04880f`.
