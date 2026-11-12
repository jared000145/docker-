import { Link } from "react-router-dom";
import { ArrowRight, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import MarketingLayout, { WHATSAPP_URL } from "@/components/marketing/MarketingLayout";
import Seo from "@/components/marketing/Seo";

const chapters = [
  {
    id: "demarrage",
    h2: "1. Démarrage : créer son établissement",
    steps: [
      "Remplissez le formulaire de préinscription en joignant les documents de l'établissement.",
      "Notre équipe vérifie le dossier, puis valide le compte et crée l'accès administrateur.",
      "Vous recevez l'adresse de connexion de votre établissement (lien dédié) ainsi que vos identifiants.",
      "À la première connexion, personnalisez le nom, le logo et les couleurs dans Paramètres.",
    ],
  },
  {
    id: "cycles",
    h2: "2. Choisir le cycle : Collège/Lycée ou Université",
    steps: [
      "Le cycle est défini à la création de l'établissement (Collège, Lycée, BTS ou Université LMD).",
      "Le cycle scolaire active les classes, trimestres, bulletins trimestriels et le suivi des absences.",
      "Le cycle universitaire active les filières, UE, semestres, crédits ECTS et relevés de notes.",
      "Les menus de l'administration s'adaptent automatiquement au cycle choisi.",
    ],
  },
  {
    id: "structure",
    h2: "3. Structurer l'année académique",
    steps: [
      "Créez l'année académique active, puis les classes (ou filières et niveaux).",
      "Ajoutez les matières (ou UE et matières) et affectez les coefficients ou crédits.",
      "Assignez un professeur à chaque matière et associez les salles disponibles.",
      "Construisez l'emploi du temps hebdomadaire ; il est visible côté élève, parent et professeur.",
    ],
  },
  {
    id: "utilisateurs",
    h2: "4. Créer les utilisateurs",
    steps: [
      "Élèves/étudiants : création individuelle ou import Excel en masse, avec matricule généré automatiquement.",
      "Professeurs : création par l'administration, matricule et accès dédiés.",
      "Parents : rattachés à un ou plusieurs enfants pour suivre notes, absences et paiements.",
      "Équipe administrative : droits par module via la gestion d'équipe.",
    ],
  },
  {
    id: "notes",
    h2: "5. Notes, bulletins et relevés",
    steps: [
      "Saisie des notes par matière : l'administration ou le professeur remplit la grille de la classe.",
      "Cycle scolaire : moyennes trimestrielles, rang, appréciations et bulletin PDF par trimestre.",
      "Cycle universitaire : moyennes par UE, validation, crédits, rattrapages et relevé semestriel.",
      "Chaque document PDF est généré avec un QR code de vérification en ligne.",
    ],
  },
  {
    id: "finances",
    h2: "6. Finances et paiements",
    steps: [
      "Configurez les types de frais (inscription, scolarité, tenue, etc.) et leurs montants.",
      "La dette initiale de chaque élève est calculée automatiquement à l'inscription.",
      "Enregistrez les paiements ; un reçu numéroté et vérifiable est généré.",
      "Suivez l'avancement par catégorie et par classe depuis l'espace Finances.",
    ],
  },
  {
    id: "communication",
    h2: "7. Communication",
    steps: [
      "Notifications automatiques lors de la publication des notes ou d'un changement d'emploi du temps.",
      "Messagerie interne entre administration, professeurs, élèves et parents.",
      "Messages de diffusion ciblés par classe, filière ou niveau.",
      "Liens de visioconférence partagés directement aux étudiants concernés.",
    ],
  },
  {
    id: "verification",
    h2: "8. Vérifier un document",
    steps: [
      "Scannez le QR code présent sur un bulletin, un relevé, une attestation ou un reçu.",
      "Une page publique affiche l'identité de l'élève, les résultats et la décision.",
      "Si le document n'existe pas dans la base, la vérification échoue : le document n'est pas authentique.",
    ],
  },
  {
    id: "securite",
    h2: "9. Sécurité et isolation des données",
    steps: [
      "Chaque établissement dispose d'un espace isolé : aucune donnée n'est partagée entre établissements.",
      "Les accès sont contrôlés par rôle (administration, direction, professeur, élève, parent).",
      "La connexion se fait exclusivement depuis la page de l'établissement de l'utilisateur.",
      "Des sauvegardes et restaurations sont disponibles côté administration globale.",
    ],
  },
];

const DocumentationPage = () => {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "HowTo",
      name: "Documentation RectorPlus",
      description: "Guide d'utilisation de la plateforme RectorPlus pour les établissements scolaires et universitaires.",
      step: chapters.map((c, i) => ({
        "@type": "HowToStep",
        position: i + 1,
        name: c.h2,
        text: c.steps.join(" "),
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: "https://rectorplus.com/" },
        { "@type": "ListItem", position: 2, name: "Documentation", item: "https://rectorplus.com/documentation" },
      ],
    },
  ];

  return (
    <MarketingLayout>
      <Seo
        title="Documentation RectorPlus — guide d'utilisation complet"
        description="Guide pas à pas de RectorPlus : création de l'établissement, classes et filières, notes et bulletins, finances, communication et vérification des documents."
        path="/documentation"
        jsonLd={jsonLd}
      />

      <section className="mx-auto max-w-4xl px-4 pb-8 pt-16 sm:px-6 lg:px-8">
        <p className="mb-4 inline-flex rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
          Documentation
        </p>
        <h1 className="mb-5 font-heading text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
          Guide d'utilisation de RectorPlus
        </h1>
        <p className="text-lg leading-relaxed text-muted-foreground">
          De la création de votre établissement à la génération des bulletins vérifiables : voici comment prendre en
          main la plateforme, que vous soyez un collège, un lycée, un BTS ou une université.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap [&>*]:w-full sm:[&>*]:w-auto">
          <Button asChild size="lg" className="btn-gold gap-2">
            <Link to="/preinscription">Créer mon établissement <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="gap-2">
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" aria-hidden="true" /> Aide sur WhatsApp
            </a>
          </Button>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <nav aria-label="Sommaire" className="rounded-2xl border border-border/50 bg-card/50 p-5">
          <h2 className="mb-3 text-sm font-semibold">Sommaire</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {chapters.map((c) => (
              <li key={c.id}>
                <a href={`#${c.id}`} className="text-sm text-muted-foreground hover:text-accent">{c.h2}</a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <article className="mx-auto max-w-4xl px-4 pb-16 sm:px-6 lg:px-8">
        {chapters.map((c) => (
          <section key={c.id} id={c.id} className="scroll-mt-24 border-t border-border/40 py-9">
            <h2 className="mb-4 font-heading text-2xl font-bold tracking-tight sm:text-3xl">{c.h2}</h2>
            <ol className="space-y-3">
              {c.steps.map((s, i) => (
                <li key={s} className="flex gap-3 rounded-xl border border-border/50 bg-card/50 p-4 text-sm leading-relaxed">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-semibold text-accent">
                    {i + 1}
                  </span>
                  <span className="text-muted-foreground">{s}</span>
                </li>
              ))}
            </ol>
          </section>
        ))}

        <section className="rounded-3xl border border-accent/30 bg-card/60 p-10 text-center">
          <h2 className="mb-3 font-heading text-2xl font-bold tracking-tight sm:text-3xl">Besoin d'un accompagnement ?</h2>
          <p className="mx-auto mb-7 max-w-2xl text-muted-foreground">
            Notre équipe configure votre établissement avec vous : classes, matières, frais de scolarité et import des
            élèves.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="btn-gold gap-2">
              <Link to="/contact">Demander une démo <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/blog">Lire le blog</Link>
            </Button>
          </div>
        </section>
      </article>
    </MarketingLayout>
  );
};

export default DocumentationPage;
