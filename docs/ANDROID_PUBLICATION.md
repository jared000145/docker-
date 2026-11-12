# RectorPlus Android — version 1.0.0

Identifiant : `com.rectorplus.app`. Android minimum : 7.0 (API 24).
Cible de compilation et de publication : Android 16 (API 36).
L’application utilise la même base Supabase que le site ; les opérations métier
nécessitent une connexion. Les identifiants existants restent utilisables.

## Fichiers de diffusion

Téléchargement direct : https://rectorplus.vercel.app/downloads/RectorPlus-1.0.0.apk
Sur le téléphone, ouvrir ce lien, puis autoriser l’installation depuis le navigateur
si Android le demande. Utiliser l’onglet Email pour les comptes d’administration
et les parents ; les étudiants et enseignants peuvent utiliser leur matricule.
La variante `-test.apk` sert uniquement aux contrôles et utilise un identifiant séparé.

- `RectorPlus-1.0.0.apk` : installation directe, signé par la clé d’application.
- `RectorPlus-1.0.0-playstore.aab` : import Play Console, signé par la clé d’envoi.
- `RectorPlus-1.0.0-test.apk` : variante de test séparée (`com.rectorplus.app.debug`).
- `checksums.json` : empreintes SHA-256 des livrables.
- `store-assets/` : icône 512 × 512 et visuel 1 024 × 500.

## Mises à jour ordonnées

Deux niveaux sont séparés :
1. Le numéro de l’application Android (`nativeVersion` et `nativeCode`).
2. Le numéro de son interface (`webVersion` et `webBuild`).

Une interface compatible est téléchargée sur Wi-Fi, vérifiée par une signature
RSA et une empreinte SHA-256, décompressée dans un dossier temporaire puis
préparée de façon atomique. Le changement s’effectue à la prochaine ouverture,
ou par le bouton de redémarrage après enregistrement des saisies. Un échec de
démarrage non confirmé entraîne un retour à la version précédente.

Une version qui demande un autre contrat natif n’est jamais activée sur une
ancienne application. Si la nouvelle application est publiée sur Google Play,
une indication et une notification, autorisée par l’utilisateur, ouvrent sa
fiche Play Store. Aucune nouvelle APK n’est téléchargée ou installée par ce
mécanisme. Seuls les fichiers d’interface interprétés sont acceptés ; les
fichiers DEX, JAR et bibliothèques natives sont refusés.

Vérification au premier plan : environ une fois par minute. Android planifie
également un contrôle en arrière-plan, sur réseau non facturé, avec un intervalle
minimal de 15 minutes ; l’OS peut différer son exécution. Ce mécanisme ne promet
pas une notification instantanée lorsque l’application est fermée ou restreinte.

Les manifestes signés sont servis sur `https://rectorplus.vercel.app/mobile/`.
Les canaux `stable` et `preview` sont séparés. La clé privée ne fait partie ni
du site ni de l’APK. Une publication web ordinaire ne modifie pas à elle seule
les applications installées : préparer explicitement une version mobile évite
qu’une migration majeure arrive avant l’application compatible.

## Préparer les versions suivantes

Modifier `mobile/release.json` : incrémenter `webBuild` pour chaque interface et
son numéro lisible, par exemple 1.0.1. Pour un nouveau binaire, incrémenter aussi
`nativeCode` (1, 2, 3…) et `nativeVersion` (1.0.0, 1.1.0, 2.0.0…). La borne
`minNativeCode/maxNativeCode` et `nativeApi` définissent la compatibilité.
Ne jamais réutiliser un code Android déjà publié ou un numéro de build mobile
avec un contenu différent. Maintenir les API serveur compatibles avec les
anciennes applications encore supportées.

- `npm run android:release` : tests natifs, APK et AAB signés, manifeste mobile.
- `node scripts/mobile/verify.mjs` : vérification des empreintes et signatures des livrables.
- `npm run mobile:web` : interface et manifeste signés sans nouvelle APK.
- `node scripts/mobile/build.mjs --web-only --preview-only` : canal de test.

Publier ensuite le site Vercel afin de diffuser ensemble le paquet complet et
son manifeste. Passer `storePublished` à `true` uniquement après mise en ligne
effective de la fiche Google Play. Dans la première livraison il reste `false` :
aucun lien Play Store ne sera présenté comme disponible avant sa publication.

## Signature et continuité avec Google Play

Les deux clés sont conservées dans `.tools/android-signing/rectorplus-release.p12`.
Le secret et la clé des mises à jour sont protégés par Windows DPAPI, pour
l’utilisateur actuel. Ce répertoire est exclu de Git, de Vercel et des paquets.
Les certificats `.pem` fournis sont publics et ne contiennent aucune clé privée.

Pour que Google Play puisse mettre à jour l’APK distribué directement, choisir
**une clé de signature d’application existante** pendant l’inscription à Play
App Signing : alias `rectorplus-app`. Utiliser l’assistant PEPK fourni par Google
pour transmettre cette clé de façon chiffrée. La clé `rectorplus-upload` sert
uniquement aux AAB envoyés et son certificat public est fourni séparément.
Ne pas laisser Google générer une autre clé d’application si la continuité
avec cet APK est souhaitée.

Sauvegarder les clés de façon indépendante avant publication. Les fichiers
DPAPI seuls ne constituent pas une sauvegarde portable vers un autre PC.
Aucun mot de passe ni clé privée ne doit être envoyé dans le chat.

## Dernières opérations dans Play Console

La préparation des fichiers ne publie pas l’application chez Google. Il faut
un compte développeur vérifié, créer la fiche `com.rectorplus.app`, configurer
Play App Signing, importer l’AAB sur une piste de test, fournir les captures,
les accès de test au logiciel, les déclarations de sécurité des données,
le public visé et les coordonnées légales de l’éditeur. La politique de
confidentialité du site doit correspondre à ces déclarations. Le logiciel peut
contenir des données d’élèves mineurs : renseigner le public réel, sans déclarer
une application pour enfants par défaut. Google décide de l’acceptation.

Sources officielles consultées :
- https://developer.android.com/google/play/requirements/target-sdk
- https://support.google.com/googleplay/android-developer/answer/9859152
- https://support.google.com/googleplay/android-developer/answer/9842756
- https://support.google.com/googleplay/android-developer/answer/18265346
