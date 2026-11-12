# Lot transversal administration — en cours (9 novembre 2026)

Demande utilisateur : publier le lot précédent (déjà fait sur rectorplus.com), restructurer paramètres/menu, imports/restaurations super-admin, multicampus/droits, relevés/signatures/PV, audit parents/étudiants/social/BDE/exclusions.

Aucun changement de ce nouveau lot n’est encore déployé. Les migrations nouvelles sont 202611090004 à 202611090010. Ne pas présenter le lot comme publié avant tests et déploiement.

Implémenté :
- Paramètres en 4 rubriques, enregistrement commun, retrait de la clôture annuelle dupliquée ; menus regroupés/recherche et garde des routes manquantes.
- InstitutionDataWorkbench remplace anciens écrans import/restore non fonctionnels. Modèle multi-feuilles, import sélectif, version manuelle, ajout seul ou remplacement explicite, jeton optimiste, transaction, version automatique avant modification. Modules de versions : campus/filières/classes/matières/profils existants/inscriptions/planning/notes/paiements/présences. Comptes, rôles, signatures et fichiers Storage ne sont pas restaurés. Pas de suppression automatique. Limites : fichier 5 Mo/2000 lignes ; opération SQL 10000 lignes.
- PV : association UUID enseignant/matière, chemin Storage corrigé, professor_set_pv réel ; anciennes affectations par nom résolues seulement si identité unique.
- Campus : édition/archivage et affectation des membres, principal unique via manage_campus, sélection des campus affectés côté direction, vues RLS lecture seule. Ancienne policy campuses tenant_read retirée en migration 008.
- Circuit relevés LMD : academic_results, submit_academic_results, notes incomplètes bloquées, verrouillage, snapshot, pédagogique puis cycle puis direction, signatures actives propres au signataire, document final immuable, récupération d’un bulletin individuel. PDF avec résultats/signatures du dossier et sans relecture des notes courantes. Interface suivi AcademicValidationStatus.
- Parents : contrôle serveur du lien enfant, enfant retiré réinitialise sélection ; exclusions RPC conservation/gel de dette.
- Social/BDE : RLS tenant, triggers références/default institution, annuaire public limité, médias privés signés. Vérification encore nécessaire.
- Provisioning : migration 010 ajoute validation classe/filière/campus, inscription student_years et academic_scope équipe. Handler modifié academic_scope (nécessite redéployer fonctions concernées).

Tests :
- TypeScript a passé avant les dernières modifications (relancer).
- scripts/test-backend.mjs inclut désormais tests données et workflow, passes complets jusqu’à migration009 à la dernière exécution avant migration010. Les tests workflow ont confirmé campus assigné, incomplets bloqués, trois étapes, mauvais signataire rejeté, immutable, bulletin individuel et PV.
- Deux fichiers scripts/test-*.fragment.mjs sont des sources temporaires des tests déjà copiés dans test-backend ; peuvent être retirés après stabilisation.
- Dernière session TypeScript 35661 à consulter.

À terminer impérativement :
1. TypeScript/tests unitaires/nouveaux tests parseInstitutionWorkbook et garde routes, vérifier nouvelles migrations010 et scénarios parents/social/exclusions/provisioning.
2. Campus : filtrer rapports/finances directeur selon sélection (RLS déjà borne les campus affectés), paramètres propres à chaque utilisateur ; s’assurer affectation Excel possible et protégée. Politique module_access peut rester trop large pour un directeur à qui on accorde aussi un module administratif : ajouter la restriction de campus aux policies concernées.
3. Signatures : UI private image et helper introduits, vérifier aperçu réel. PDF footer passé à trois signatures, valider rendu.
4. Collège/lycée : circuit actuel class_bulletins_trimestre reste incomplet. Le T3 ne supprime plus les plannings et n’appelle plus un RPC absent de promotion. Il faut rendre la clôture trimestrielle atomique avec snapshots et support de téléchargement correct (pas un PDF LMD vide). buildTrimestreBulletinBlob relit des données courantes et utilise une signature active globale ; à corriger pour ne pas signer un aperçu non validé.
5. Étudiant/parent : notes par année, moyennes sans assimiler notes manquantes à zéro, téléchargement d’un bulletin validé. Contrôler liaisons réelles via comptes QA uniquement.
6. Remplacer/retirer anciens écrans sauvegardes Drive non configurés et doublons inutiles ; ne pas prétendre sauvegarde indépendante pour les versions stockées dans la même base.
7. Valider paramètres/menu/workbench/campus via Playwright local puis déployer migrations et frontend, fonctions modifiées ; QA en ligne sur données taguées uniquement, nettoyage exact.
8. Documentation de périmètre/limites et publication réelle.

Outils : node .tools/node.exe ; PATH=.tools ; npm node .tools/package/bin/npm-cli.js ; NODE_EXTRA_CA_CERTS=.tools/windows-roots.pem. Vercel .tools/deploy-tools/node_modules/vercel/dist/vc.js, Supabase .tools/deploy-tools/node_modules/supabase/dist/supabase.js. Supabase ref ruouwtuetbuyxwrpqzfc. Dernière prod avant lot dpl_3QL8dFGzgE4exgG74vw74X2vd5Er. Scripts QA .tools/check-admin-tools.mjs (mock), .tools/check-live-admin-tools.mjs (données test isolées + nettoyage). Ne pas reconstruire dist pendant un test navigateur. Preview local port4174 déjà lancé. Autorisation utilisateur de publier persistante.

## État publié et changement d’adresse

Le lot a été publié le 9 novembre 2026 : Vercel
`dpl_EgitB3NRX5t3Ap7yQE4BK5Na8nMF`, 25 migrations SQL installées.
Compilation et TypeScript réussis, 67 tests unitaires réussis, tests SQL étendus
réussis, parcours navigateur local sur paramètres/import/restauration/mobile
réussi. Essai réel : import super-admin, ligne créée, campus, saisie professeur,
validation en trois étapes, accès parent isolé, restauration sélective et
PDF signé téléchargé par le parent réussis, aucune erreur JavaScript relevée.
Neuf comptes temporaires et leur établissement ont été supprimés ; les comptes
existants sont restés intacts. Sauvegarde chiffrée avant migrations :
`.tools/backups/2026-11-09T14-24-36.501Z` (capture, restauration de cette capture
non certifiée).

À la demande suivante de l’utilisateur, rectorplus.com et www.rectorplus.com
ont été détachés du projet Vercel. L’adresse active est désormais
https://rectorplus.vercel.app ; accueil et /super-admin répondent HTTP 200 sans
redirection, CORS des fonctions vérifié. PUBLIC_APP_URL Supabase a été réglée
sur cette adresse. La propriété du domaine IONOS et ses DNS ne sont pas modifiés.

Prochaine demande conservée : APK Android installable + AAB Play Store signé,
version 1.0.0 et mises à jour compatibles ordonnées, nouvelles versions natives
via le Play Store avec notification. Préparation interrompue pour le changement
d’adresse ; aucun nouveau fichier APK/AAB produit. SDK Android 36 installé,
JDK 21 disponible dans Android Studio/jbr, aucun appareil connecté ni AVD.
