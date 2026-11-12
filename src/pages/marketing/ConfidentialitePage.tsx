import MarketingLayout, { CONTACT_EMAIL } from "@/components/marketing/MarketingLayout";
import Seo from "@/components/marketing/Seo";

const sections = [
  {
    h2: "1. Qui traite vos données",
    body: [
      "RectorPlus fournit une plateforme de gestion scolaire et universitaire aux établissements d'enseignement. Pour les données scolaires (élèves, notes, absences, paiements), l'établissement est responsable de traitement et RectorPlus agit comme sous-traitant technique.",
      "Pour les données collectées sur le site public (formulaire de contact, demande de démonstration, préinscription d'établissement), RectorPlus est responsable de traitement.",
    ],
  },
  {
    h2: "2. Données collectées",
    bullets: [
      "Identité et contact : nom, prénom, e-mail, téléphone, établissement.",
      "Données scolaires saisies par l'établissement : matricule, classe/filière, notes, absences, documents.",
      "Données de facturation et de paiement de scolarité gérées par l'établissement.",
      "Données techniques de connexion nécessaires au fonctionnement et à la sécurité du service.",
      "Pièces de préinscription : identité du responsable, immatriculation, identification fiscale, autorisation d’ouverture et logo de l’établissement.",
    ],
  },
  {
    h2: "3. Finalités",
    bullets: [
      "Fournir les fonctionnalités de la plateforme (scolarité, notes, bulletins, finances, communication).",
      "Gérer l'authentification, les rôles et la sécurité des comptes.",
      "Répondre aux demandes de contact, de démonstration et de préinscription.",
      "Assurer le support, la maintenance et l'amélioration du service.",
    ],
  },
  {
    h2: "4. Base légale",
    body: [
      "Les traitements reposent selon les cas sur l'exécution du contrat conclu avec l'établissement, sur l'intérêt légitime de RectorPlus à sécuriser et améliorer son service, sur le consentement (formulaires publics) ou sur des obligations légales.",
    ],
  },
  {
    h2: "5. Partage des données",
    body: [
      "Les données ne sont pas vendues. Elles sont accessibles aux personnes habilitées de l'établissement concerné et aux prestataires techniques strictement nécessaires au fonctionnement du service (hébergement, base de données, envoi d'e-mails), tenus à la confidentialité.",
      "L'isolation des données entre établissements est appliquée : un établissement n'accède jamais aux données d'un autre.",
      "Après accord du déposant, les pièces d’identité et justificatifs de préinscription peuvent être transmis à OpenAI pour un précontrôle de type et de lisibilité. Le service ne certifie pas leur authenticité et aucune admission n’est décidée automatiquement. RectorPlus conserve le résultat synthétique du contrôle, sans recopier les numéros d’identité extraits. Les documents restent accessibles uniquement aux personnes habilitées à examiner le dossier.",
      "Les notifications de dossier sont transmises à Resend lorsque l’envoi est configuré. Les réponses sont dirigées vers la boîte de contact définie par RectorPlus ; elles ne sont pas automatiquement importées dans la plateforme.",
    ],
  },
  {
    h2: "6. Conservation",
    body: [
      "Les données scolaires sont conservées pendant la durée d'utilisation de la plateforme par l'établissement, puis selon ses propres obligations d'archivage. Les demandes de contact sont conservées le temps nécessaire à leur traitement et au suivi commercial.",
    ],
  },
  {
    h2: "7. Sécurité",
    body: [
      "L'accès aux données est protégé par une authentification par compte, une gestion des rôles et des règles de sécurité au niveau de la base de données. Les échanges avec la plateforme sont chiffrés en transit (HTTPS).",
    ],
  },
  {
    h2: "8. Vos droits",
    body: [
      "Vous disposez de droits d'accès, de rectification, d'effacement, de limitation et d'opposition sur vos données.",
      `Pour les données scolaires, adressez votre demande à votre établissement, qui en est responsable. Pour les autres demandes, écrivez à ${CONTACT_EMAIL} ; nous transmettrons si nécessaire à l'établissement concerné.`,
    ],
  },
  {
    h2: "9. Cookies",
    body: [
        "Le site et la plateforme utilisent des cookies et un stockage local strictement nécessaires au fonctionnement (session de connexion, sécurité et préférences d'affichage). Avec votre accord, des mesures d'audience anonymes peuvent aussi être utilisées afin d'améliorer le service. Aucun cookie publicitaire n'est déposé.",
        "Lors de votre première visite, vous pouvez accepter l'ensemble des cookies ou conserver uniquement ceux qui sont nécessaires. Votre choix est mémorisé sur votre appareil.",
    ],
  },
  {
    h2: "10. Contact",
    body: [`Pour toute question sur cette politique : ${CONTACT_EMAIL}.`],
  },
];

const ConfidentialitePage = () => (
  <MarketingLayout>
    <Seo
      title="Politique de confidentialité | RectorPlus"
      description="Comment RectorPlus collecte, utilise et protège les données des établissements, élèves, parents et professeurs : finalités, conservation, sécurité et droits."
      path="/confidentialite"
    />
    <article className="mx-auto max-w-3xl px-4 pb-20 pt-16 sm:px-6 lg:px-8">
      <p className="mb-4 inline-flex rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
        Documents légaux
      </p>
      <h1 className="mb-4 font-heading text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
        Politique de confidentialité
      </h1>
      <p className="text-muted-foreground">
        Cette politique explique quelles données sont traitées par RectorPlus, pourquoi, et comment elles sont
        protégées.
      </p>

      {sections.map((s) => (
        <section key={s.h2} className="border-t border-border/40 py-8">
          <h2 className="mb-3 font-heading text-xl font-bold tracking-tight sm:text-2xl">{s.h2}</h2>
          {s.body?.map((p, i) => (
            <p key={i} className="mb-3 leading-relaxed text-muted-foreground">{p}</p>
          ))}
          {s.bullets && (
            <ul className="mt-3 space-y-2">
              {s.bullets.map((b) => (
                <li key={b} className="rounded-xl border border-border/50 bg-card/50 p-3 text-sm text-muted-foreground">
                  {b}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </article>
  </MarketingLayout>
);

export default ConfidentialitePage;
