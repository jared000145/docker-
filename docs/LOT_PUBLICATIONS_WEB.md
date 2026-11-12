# Publications web progressives — 9 novembre 2026

Le propriétaire autorise la publication progressive des améliorations après
vérification. Les opérations destructives restent soumises à une autorisation
spécifique. Aucune migration n'est nécessaire pour ce lot.

Le contrôle de version web existant est renforcé :

- Vérification toutes les 30 secondes dans un onglet actif, au retour de réseau
  et à la reprise de focus.
- Une seule requête à la fois, expiration après huit secondes.
- Réponses invalides ou indisponibilité réseau sans interruption de la page.
- Avis retiré si le serveur revient à la version actuellement ouverte.
- Actualisation déclenchée uniquement par l'utilisateur ; aucune saisie n'est
  effacée par une publication automatique.
- « Plus tard » masque la version concernée, puis un autre déploiement peut
  produire un nouvel avis.

L'APK embarqué reste indépendant : il ne reçoit pas ce mécanisme comme une mise
à jour native. La synchronisation des données Supabase reste distincte de la
publication du code web.

Sauvegarde avant modification :
`.tools/snapshots/publication-avant-20261109.zip`.

Vérifications : tests dédiés réseau/version, vérification TypeScript,
compilation Vercel et essai navigateur du comportement sur le site publié.
L'essai navigateur simule deux nouvelles versions et un retour arrière dans la
réponse de `version.json`, sans modifier les données du service.

Résultats : TypeScript réussi ; cinq tests dédiés réussis ; compilation Vercel
réussie ; essai navigateur sur le domaine réussi (détection, saisie conservée,
report d'une version, nouvelle version détectée, retour arrière, zéro erreur JS).
Déploiement : `dpl_9HCaoTMJspYdpoDs5yEjdeVD6ZK1`, état READY, production.
Le résolveur DNS local renvoie maintenant `216.198.79.1` comme les serveurs
faisant autorité : le cache de l'ancienne destination a expiré.
