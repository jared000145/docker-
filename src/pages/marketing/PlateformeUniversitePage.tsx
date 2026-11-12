import MarketingContentPage from "@/components/marketing/MarketingContentPage";

const PlateformeUniversitePage = () => (
  <MarketingContentPage
    path="/plateforme-universite"
    title="Plateforme université : gestion LMD, crédits ECTS et relevés | RectorPlus"
    description="Plateforme de gestion universitaire RectorPlus : UE et crédits ECTS, validation par compensation, relevés de notes semestriels vérifiables par QR code, scolarité, soutenances et visioconférence."
    eyebrow="Enseignement supérieur"
    h1="Plateforme université : gérez le LMD, les crédits et la scolarité sans friction"
    intro="RectorPlus est une plateforme université complète qui modélise réellement le supérieur : filières, niveaux, unités d'enseignement, crédits ECTS, sessions de rattrapage, validation par compensation, relevés semestriels et délibérations. Une solution unique pour les universités, instituts et écoles supérieures."
    sections={[
      {
        h2: "Une plateforme conçue pour la logique LMD",
        paragraphs: [
          "Le supérieur ne se gère pas comme un lycée. Une plateforme université doit comprendre la structure Licence-Master-Doctorat, les unités d'enseignement composées de plusieurs matières, la pondération par crédits, les semestres indépendants et les règles de compensation propres à chaque établissement.",
          "RectorPlus modélise cette hiérarchie nativement : filière, niveau, semestre, UE, matière. Chaque matière porte son coefficient et son volume horaire, chaque UE son total de crédits. Les moyennes remontent automatiquement de la matière vers l'UE, puis de l'UE vers le semestre et l'année.",
          "L'établissement choisit son mode de validation des UE — par moyenne ou par matière — et la plateforme applique la règle de manière homogène pour tous les étudiants, sans exception manuelle non tracée.",
        ],
        bullets: [
          "Filières, niveaux et semestres configurables",
          "UE avec crédits ECTS et matières pondérées",
          "Validation par moyenne ou par matière au choix",
          "Validation par compensation (VPC) signalée sur le relevé",
          "Sessions de rattrapage avec conservation de la meilleure note",
          "Délibérations et clôture d'année automatisées",
        ],
      },
      {
        h2: "Relevés de notes semestriels et vérification par QR code",
        paragraphs: [
          "Chaque semestre donne lieu à un relevé de notes officiel au format PDF : matières, notes, coefficients, moyennes d'UE, crédits acquis, moyenne semestrielle et décision. Lorsqu'une matière est validée grâce à la compensation au sein de son UE, la mention VPC apparaît explicitement et les crédits de l'UE sont attribués intégralement.",
          "Chaque document porte un QR code. Le scanner ouvre une page publique de vérification qui confirme l'authenticité du relevé et affiche les éléments essentiels : identité de l'étudiant, filière, semestre, moyenne, crédits et décision. Lorsque les deux semestres existent, la vérification affiche le récapitulatif annuel consolidé.",
          "Pour les services de scolarité, cela signifie la fin des vérifications téléphoniques et des faux documents en circulation.",
        ],
      },
      {
        h2: "Scolarité, inscriptions et suivi financier",
        paragraphs: [
          "Les inscriptions administratives et pédagogiques sont centralisées : dossier étudiant, pièces justificatives, affectation en filière et niveau, réinscription d'une année à l'autre avec conservation de l'historique académique complet.",
          "Côté finances, les frais sont paramétrables par filière et par niveau. Chaque paiement génère un reçu numéroté, et la direction suit le recouvrement en temps réel. Les étudiants consultent leur solde et leurs échéances depuis leur espace personnel.",
        ],
        subsections: [
          {
            h3: "Historique académique complet",
            text: "Chaque année validée est archivée avec ses relevés, ses crédits cumulés et ses décisions. Un étudiant en Master conserve l'intégralité de son parcours de Licence, consultable par l'administration.",
          },
          {
            h3: "Carte étudiante numérique",
            text: "Chaque étudiant dispose d'une carte numérique avec QR code permettant d'attester son statut et d'accéder à son espace.",
          },
        ],
      },
      {
        h2: "Enseignement hybride : planning, visioconférence et bibliothèque",
        paragraphs: [
          "Les emplois du temps se construisent par filière et niveau, avec attribution des salles et détection des conflits. Toute modification déclenche une notification immédiate aux étudiants et aux enseignants concernés.",
          "Les enseignants peuvent lancer une session de visioconférence rattachée à un cours : les étudiants reçoivent une notification avec le lien de connexion. La bibliothèque numérique met à disposition supports de cours, ouvrages et ressources consultables directement en ligne.",
          "Les soutenances sont planifiées avec jury, date, salle et archivage des enregistrements.",
        ],
      },
      {
        h2: "Multi-campus et gouvernance",
        paragraphs: [
          "Les universités multi-sites gèrent plusieurs campus sous une même entité, avec une vue consolidée pour la direction générale et des vues cloisonnées pour chaque campus. Les rôles sont finement paramétrables : direction, scolarité, service financier, responsable pédagogique, enseignant, étudiant.",
          "Chaque membre de l'équipe administrative reçoit uniquement les modules qui le concernent, ce qui limite les risques et simplifie la prise en main.",
        ],
      },
      {
        h2: "Mise en place et migration",
        paragraphs: [
          "La migration depuis un système existant se fait par import des étudiants, des filières et de l'historique des notes. L'établissement dispose ensuite d'un sous-domaine dédié à ses couleurs, avec sa propre page de connexion et ses propres administrateurs.",
          "Notre équipe accompagne le paramétrage des UE, des crédits et des règles de délibération lors du premier semestre d'utilisation.",
        ],
      },
    ]}
    faq={[
      { q: "RectorPlus gère-t-il les crédits ECTS ?", a: "Oui. Chaque UE porte un nombre de crédits, les crédits acquis sont cumulés par semestre et par année (60 crédits par an) et apparaissent sur les relevés." },
      { q: "Qu'est-ce que la validation par compensation (VPC) ?", a: "Lorsqu'une UE est validée en moyenne, une matière sous la moyenne à l'intérieur de cette UE est validée par compensation : la mention VPC s'affiche et les crédits de l'UE sont attribués en totalité." },
      { q: "Les relevés sont-ils vérifiables publiquement ?", a: "Oui, via le QR code imprimé sur le document, qui ouvre une page de vérification affichant les données authentifiées." },
      { q: "Peut-on gérer plusieurs campus ?", a: "Oui, le mode multi-campus permet une vue consolidée pour la direction et des espaces distincts par site." },
      { q: "Le BTS est-il pris en charge ?", a: "Oui, le cycle BTS dispose de son propre paramétrage, distinct du LMD et du secondaire." },
    ]}
    ctaTitle="Planifiez une démonstration pour votre université"
    ctaText="Nous configurons une filière type avec vos UE, vos crédits et vos règles de délibération, puis nous produisons un relevé de notes réel."
  />
);

export default PlateformeUniversitePage;
