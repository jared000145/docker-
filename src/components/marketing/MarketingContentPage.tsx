import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, Check, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import MarketingLayout, { WHATSAPP_URL } from "./MarketingLayout";
import Seo from "./Seo";

export interface ContentSection {
  h2: string;
  paragraphs: string[];
  bullets?: string[];
  subsections?: { h3: string; text: string }[];
}

export interface MarketingContentPageProps {
  title: string;
  description: string;
  path: string;
  eyebrow: string;
  h1: string;
  intro: string;
  sections: ContentSection[];
  faq: { q: string; a: string }[];
  ctaTitle: string;
  ctaText: string;
}

/** Page SEO éditoriale réutilisable (contenu long + FAQ + CTA de conversion). */
const MarketingContentPage = ({
  title, description, path, eyebrow, h1, intro, sections, faq, ctaTitle, ctaText,
}: MarketingContentPageProps) => {
  const jsonLd: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "RectorPlus",
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web",
      url: `https://rectorplus.com${path}`,
      description,
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: "https://rectorplus.com/" },
        { "@type": "ListItem", position: 2, name: h1, item: `https://rectorplus.com${path}` },
      ],
    },
  ];

  return (
    <MarketingLayout>
      <Seo title={title} description={description} path={path} jsonLd={jsonLd} />

      <section className="mx-auto max-w-4xl px-4 pb-10 pt-16 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
          <p className="mb-4 inline-flex rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
            {eyebrow}
          </p>
          <h1 className="mb-5 font-heading text-4xl font-bold leading-tight tracking-tight sm:text-5xl">{h1}</h1>
          <p className="text-lg leading-relaxed text-muted-foreground">{intro}</p>
          <div className="mt-8 flex flex-col sm:flex-row sm:flex-wrap gap-3 [&>*]:w-full sm:[&>*]:w-auto">
            <Button asChild size="lg" className="btn-gold gap-2">
              <Link to="/contact">Demander une démo <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/preinscription">Commencer gratuitement</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="gap-2">
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4" aria-hidden="true" /> WhatsApp
              </a>
            </Button>
          </div>
        </motion.div>
      </section>

      <article className="mx-auto max-w-4xl px-4 pb-16 sm:px-6 lg:px-8">
        {sections.map((s) => (
          <section key={s.h2} className="border-t border-border/40 py-10">
            <h2 className="mb-4 font-heading text-2xl font-bold tracking-tight sm:text-3xl">{s.h2}</h2>
            {s.paragraphs.map((p, i) => (
              <p key={i} className="mb-4 leading-relaxed text-muted-foreground">{p}</p>
            ))}
            {s.bullets && (
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {s.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 rounded-xl border border-border/50 bg-card/50 p-4 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}
            {s.subsections?.map((sub) => (
              <div key={sub.h3} className="mt-6">
                <h3 className="mb-2 font-heading text-lg font-semibold">{sub.h3}</h3>
                <p className="leading-relaxed text-muted-foreground">{sub.text}</p>
              </div>
            ))}
          </section>
        ))}

        <section className="border-t border-border/40 py-10">
          <h2 className="mb-6 font-heading text-2xl font-bold tracking-tight sm:text-3xl">Questions fréquentes</h2>
          <div className="space-y-3">
            {faq.map((f) => (
              <details key={f.q} className="group rounded-xl border border-border/50 bg-card/60 p-5">
                <summary className="cursor-pointer list-none font-medium">{f.q}</summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-accent/30 bg-card/60 p-10 text-center">
          <h2 className="mb-3 font-heading text-3xl font-bold tracking-tight">{ctaTitle}</h2>
          <p className="mx-auto mb-7 max-w-2xl text-muted-foreground">{ctaText}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" className="btn-gold gap-2">
              <Link to="/contact">Demander une démo <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/preinscription">Commencer gratuitement</Link>
            </Button>
          </div>
        </section>

        <nav aria-label="Pages liées" className="mt-10 flex flex-wrap gap-4 text-sm">
          <Link className="text-accent hover:underline" to="/logiciel-gestion-scolaire">Logiciel de gestion scolaire</Link>
          <Link className="text-accent hover:underline" to="/plateforme-universite">Plateforme université</Link>
          <Link className="text-accent hover:underline" to="/school-management-system">School management system</Link>
          <Link className="text-accent hover:underline" to="/blog">Blog RectorPlus</Link>
        </nav>
      </article>
    </MarketingLayout>
  );
};

export default MarketingContentPage;
