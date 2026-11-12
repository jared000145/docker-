import MarketingContentPage from "@/components/marketing/MarketingContentPage";

const LogicielGestionScolairePage = () => (
  <MarketingContentPage
    path="/logiciel-gestion-scolaire"
    title="Logiciel de gestion scolaire pour écoles, collèges et lycées | RectorPlus"
    description="RectorPlus est un logiciel de gestion scolaire complet : notes et bulletins PDF, emploi du temps, paiements et reçus, absences, communication parents. Conçu pour l'Afrique et l'Europe. Démo gratuite."
    eyebrow="Solution complète"
    h1="Logiciel de gestion scolaire : pilotez tout votre établissement depuis une seule plateforme"
    intro="RectorPlus centralise les inscriptions, les notes, les bulletins, l'emploi du temps, les paiements et la communication avec les familles. Un logiciel école pensé pour les réalités africaines et européennes : rapide, accessible sur mobile, et adapté au collège, au lycée comme à l'enseignement primaire."
    sections={[
      {
        h2: "À quoi sert réellement un logiciel de gestion scolaire ?",
        paragraphs: [
          "Un logiciel de gestion scolaire remplace l'ensemble des registres, tableurs et cahiers qui circulent dans un établissement par une base unique, partagée et sécurisée. Chaque élève y possède un dossier complet : état civil, tuteurs, classe, notes, absences, paiements et documents officiels. Le personnel administratif cesse de ressaisir les mêmes informations dans cinq fichiers différents.",
          "Concrètement, la direction sait à tout moment combien d'élèves sont inscrits par classe, quel est le taux de recouvrement des frais de scolarité, quelles moyennes se dégagent par matière et quels professeurs n'ont pas encore saisi leurs notes. Cette visibilité transforme la gestion réactive en pilotage.",
          "RectorPlus va plus loin que la simple base de données : la plateforme applique automatiquement les règles pédagogiques de votre établissement — coefficients, trimestres, rattrapages, seuils de passage — pour produire des documents officiels sans intervention manuelle.",
        ],
        bullets: [
          "Dossier élève complet et historisé année après année",
          "Notes, moyennes, rangs et bulletins générés automatiquement",
          "Emploi du temps hebdomadaire avec gestion des salles",
          "Frais de scolarité, échéanciers, reçus numérotés",
          "Absences et retards saisis en classe par le professeur",
          "Notifications ciblées vers élèves, parents et enseignants",
        ],
      },
      {
        h2: "Notes, bulletins et documents officiels vérifiables",
        paragraphs: [
          "La production des bulletins est le cœur du métier. RectorPlus calcule les moyennes pondérées par coefficient, les moyennes de classe, les rangs, les mentions et les décisions de passage selon les règles définies par l'établissement. Les rattrapages sont pris en compte automatiquement, et la meilleure note entre l'évaluation initiale et le rattrapage est retenue.",
          "Chaque bulletin, relevé ou attestation est généré au format PDF officiel, avec le logo de l'établissement, la signature du chef d'établissement et un QR code de vérification. Toute personne recevant le document peut scanner ce code et vérifier en ligne son authenticité ainsi que les données qu'il contient.",
        ],
        subsections: [
          {
            h3: "Saisie des notes par les professeurs",
            text: "Chaque enseignant accède uniquement aux classes et matières qui lui sont attribuées. Il saisit les notes dans une grille claire, voit immédiatement les élèves manquants, et l'administration suit l'avancement de la saisie en temps réel.",
          },
          {
            h3: "Clôture de trimestre ou d'année",
            text: "Au moment de la clôture, les notes sont verrouillées, les moyennes figées, les décisions calculées et l'ensemble des bulletins produit en une seule opération. L'année suivante démarre sur des données propres, sans perte d'historique.",
          },
        ],
      },
      {
        h2: "Gestion financière : scolarité, reçus et recouvrement",
        paragraphs: [
          "Le module financier permet de définir des frais par niveau, par série ou par filière : frais d'inscription, scolarité, tenue, examens. Chaque élève reçoit un échéancier, chaque versement génère un reçu numéroté unique, et le solde se met à jour instantanément.",
          "La direction dispose de barres de progression par catégorie de frais et par classe, ainsi que de la liste des élèves en retard de paiement. Les relances deviennent factuelles, documentées et beaucoup moins conflictuelles.",
        ],
      },
      {
        h2: "Un logiciel école pensé pour l'Afrique",
        paragraphs: [
          "Les contraintes locales sont réelles : connexion parfois limitée, matériel hétérogène, effectifs importants, élèves orientés par l'État, frais différenciés. RectorPlus a été conçu avec ces réalités en tête. L'interface est légère, fonctionne parfaitement sur un smartphone de milieu de gamme, et les documents produits respectent les conventions administratives locales.",
          "La plateforme gère les élèves orientés par l'État avec une tarification distincte, les séries du lycée, les classes de collège, les indicatifs téléphoniques internationaux et les nationalités multiples. Elle s'utilise aussi bien à Libreville qu'à Paris.",
        ],
      },
      {
        h2: "Sécurité, isolation des données et conformité",
        paragraphs: [
          "Chaque établissement dispose d'un espace strictement cloisonné. L'isolation est appliquée au niveau de la base de données : aucune requête ne peut franchir la frontière entre deux institutions, même en cas d'erreur applicative.",
          "Les rôles sont granulaires — super administrateur, direction, administration, professeur, parent, élève — et chaque suppression sensible est journalisée. Des sauvegardes exportables permettent à l'établissement de conserver ses propres copies.",
        ],
      },
      {
        h2: "Déploiement et accompagnement",
        paragraphs: [
          "La mise en route se fait en trois étapes : préinscription de l'établissement avec les documents justificatifs, validation du dossier par notre équipe sous 24 à 48 heures, puis remise des identifiants du compte administrateur principal. Les élèves peuvent être importés en masse depuis un fichier Excel existant.",
          "Chaque établissement obtient un sous-domaine dédié, par exemple mon-ecole.rectorplus.com, avec son logo, ses couleurs et sa propre page de connexion. Les utilisateurs d'un établissement ne peuvent se connecter que via leur propre portail.",
        ],
      },
    ]}
    faq={[
      { q: "Le logiciel convient-il à une école primaire ?", a: "Oui. RectorPlus s'adapte au cycle choisi : primaire, collège, lycée, BTS ou université. Seuls les modules pertinents pour votre cycle sont affichés." },
      { q: "Peut-on importer nos élèves depuis Excel ?", a: "Oui, un import de masse est prévu : les élèves sont créés avec leur matricule, leur classe, leurs tuteurs et leur dette initiale calculée selon les frais du niveau." },
      { q: "Les parents ont-ils un accès ?", a: "Oui, chaque parent dispose d'un espace pour consulter les notes, absences, plannings et paiements de son enfant." },
      { q: "Combien coûte le logiciel ?", a: "Les offres démarrent à 150 000 FCFA par mois pour les petits établissements, avec une formule Pro pour les effectifs illimités et une offre Entreprise sur devis pour les groupes scolaires." },
      { q: "Faut-il installer un serveur ?", a: "Non. RectorPlus est une plateforme cloud accessible depuis un navigateur, sans installation ni maintenance de serveur." },
    ]}
    ctaTitle="Voyez RectorPlus avec vos propres données"
    ctaText="Demandez une démonstration : nous configurons vos classes, vos coefficients et un bulletin d'exemple pour que vous jugiez sur pièces."
  />
);

export default LogicielGestionScolairePage;
