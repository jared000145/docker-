import MarketingLayout, { CONTACT_EMAIL } from "@/components/marketing/MarketingLayout";
import Seo from "@/components/marketing/Seo";

const sections = [
  {
    h2: "1. Objet",
    body: [
      "Les présentes Conditions Générales d'Utilisation (CGU) encadrent l'accès et l'utilisation de la plateforme RectorPlus, logiciel de gestion scolaire et universitaire édité pour les établissements d'enseignement.",
      "Toute utilisation de la plateforme implique l'acceptation pleine et entière des présentes CGU par l'établissement client et par ses utilisateurs (administration, direction, professeurs, élèves/étudiants, parents).",
    ],
  },
  {
    h2: "2. Accès au service",
    body: [
      "L'accès à RectorPlus est réservé aux établissements disposant d'un compte actif et aux utilisateurs créés par l'administration de leur établissement. Il n'existe pas d'inscription publique libre.",
      "Chaque utilisateur est responsable de la confidentialité de ses identifiants de connexion et de toute activité effectuée depuis son compte. Toute suspicion d'accès non autorisé doit être signalée sans délai à l'établissement ou à RectorPlus.",
    ],
  },
  {
    h2: "3. Utilisation de la plateforme",
    body: [
      "La plateforme doit être utilisée conformément à sa finalité pédagogique et administrative.",
    ],
    bullets: [
      "Ne pas tenter d'accéder aux données d'un autre établissement ou d'un autre utilisateur.",
      "Ne pas perturber, contourner ou tester les mécanismes de sécurité de la plateforme.",
      "Ne pas publier de contenu illicite, diffamatoire ou portant atteinte à autrui.",
      "Ne pas extraire ou réutiliser massivement les données à des fins étrangères à l'établissement.",
    ],
  },
  {
    h2: "4. Données et contenus de l'établissement",
    body: [
      "L'établissement reste propriétaire des données qu'il saisit ou importe (élèves, notes, paiements, documents). RectorPlus agit comme prestataire technique d'hébergement et de traitement pour le compte de l'établissement.",
      "L'établissement s'engage à disposer des bases légales nécessaires pour traiter les données des personnes concernées et à informer celles-ci de l'utilisation de la plateforme.",
    ],
  },
  {
    h2: "5. Disponibilité et maintenance",
    body: [
      "RectorPlus met en œuvre les moyens raisonnables pour assurer la disponibilité du service. Des interruptions peuvent survenir pour maintenance, mise à jour ou en raison de causes extérieures (réseau, hébergeur, force majeure).",
    ],
  },
  {
    h2: "6. Propriété intellectuelle",
    body: [
      "La plateforme, son code, son interface, sa marque et ses éléments graphiques restent la propriété exclusive de RectorPlus. Aucun droit de reproduction, de modification ou de revente n'est concédé aux utilisateurs.",
    ],
  },
  {
    h2: "7. Responsabilité",
    body: [
      "RectorPlus ne saurait être tenu responsable des décisions académiques ou administratives prises par l'établissement, ni de l'exactitude des données saisies par ses utilisateurs.",
      "L'établissement est responsable de la gestion des rôles et des droits d'accès attribués à ses utilisateurs.",
    ],
  },
  {
    h2: "8. Suspension et résiliation",
    body: [
      "En cas de manquement grave aux présentes CGU, l'accès d'un utilisateur ou d'un établissement peut être suspendu. La résiliation de l'abonnement entraîne la fin de l'accès à la plateforme, dans les conditions convenues contractuellement.",
    ],
  },
  {
    h2: "9. Modification des CGU",
    body: [
      "RectorPlus peut faire évoluer les présentes CGU pour tenir compte des évolutions du service ou de la réglementation. Les utilisateurs sont invités à les consulter régulièrement.",
    ],
  },
  {
    h2: "10. Contact",
    body: [
      `Pour toute question relative aux présentes conditions, écrivez à ${CONTACT_EMAIL}.`,
    ],
  },
];

const CguPage = () => (
  <MarketingLayout>
    <Seo
      title="CGU — Conditions Générales d'Utilisation | RectorPlus"
      description="Conditions générales d'utilisation de la plateforme RectorPlus : accès, comptes, données des établissements, responsabilités et propriété intellectuelle."
      path="/cgu"
    />
    <article className="mx-auto max-w-3xl px-4 pb-20 pt-16 sm:px-6 lg:px-8">
      <p className="mb-4 inline-flex rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
        Documents légaux
      </p>
      <h1 className="mb-4 font-heading text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
        Conditions Générales d'Utilisation
      </h1>
      <p className="text-muted-foreground">
        Ces conditions décrivent le cadre d'utilisation de la plateforme RectorPlus par les établissements et leurs
        utilisateurs.
      </p>

      {sections.map((s) => (
        <section key={s.h2} className="border-t border-border/40 py-8">
          <h2 className="mb-3 font-heading text-xl font-bold tracking-tight sm:text-2xl">{s.h2}</h2>
          {s.body.map((p, i) => (
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

export default CguPage;
