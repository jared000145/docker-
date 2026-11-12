import { Link, Navigate, useParams } from "react-router-dom";
import { CalendarDays, Clock, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import MarketingLayout from "@/components/marketing/MarketingLayout";
import Seo from "@/components/marketing/Seo";
import { blogPosts, getPost } from "@/content/blog";

const BlogArticlePage = () => {
  const { slug } = useParams();
  const post = getPost(slug);
  if (!post) return <Navigate to="/blog" replace />;

  const others = blogPosts.filter((p) => p.slug !== post.slug);

  return (
    <MarketingLayout>
      <Seo
        type="article"
        title={post.seoTitle}
        description={post.description}
        path={`/blog/${post.slug}`}
        jsonLd={[
          {
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.title,
            description: post.description,
            datePublished: post.date,
            dateModified: post.date,
            inLanguage: post.lang,
            mainEntityOfPage: `https://rectorplus.com/blog/${post.slug}`,
            author: { "@type": "Organization", name: "RectorPlus" },
            publisher: { "@type": "Organization", name: "RectorPlus", url: "https://rectorplus.com" },
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Accueil", item: "https://rectorplus.com/" },
              { "@type": "ListItem", position: 2, name: "Blog", item: "https://rectorplus.com/blog" },
              { "@type": "ListItem", position: 3, name: post.title, item: `https://rectorplus.com/blog/${post.slug}` },
            ],
          },
        ]}
      />

      <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
        <Link to="/blog" className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Tous les articles
        </Link>

        <h1 className="mb-4 font-heading text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{post.title}</h1>
        <div className="mb-10 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            <time dateTime={post.date}>{new Date(post.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</time>
          </span>
          <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" aria-hidden="true" /> {post.readingTime}</span>
        </div>

        <p className="mb-10 border-l-2 border-accent/60 pl-4 text-lg leading-relaxed text-muted-foreground">{post.excerpt}</p>

        {post.body.map((section) => (
          <section key={section.h2} className="mb-10">
            <h2 className="mb-4 font-heading text-2xl font-bold tracking-tight">{section.h2}</h2>
            {section.paragraphs.map((p, i) => (
              <p key={i} className="mb-4 leading-relaxed text-muted-foreground">{p}</p>
            ))}
            {section.bullets && (
              <ul className="mt-4 space-y-2">
                {section.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <section className="rounded-2xl border border-accent/30 bg-card/60 p-8 text-center">
          <h2 className="mb-3 font-heading text-2xl font-bold">Découvrez RectorPlus en démonstration</h2>
          <p className="mx-auto mb-6 max-w-xl text-sm text-muted-foreground">
            Notes, bulletins, paiements, planning et communication : une seule plateforme pour votre établissement.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild className="btn-gold gap-2"><Link to="/contact">Demander une démo <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link></Button>
            <Button asChild variant="outline"><Link to="/preinscription">Commencer gratuitement</Link></Button>
          </div>
        </section>

        <nav aria-label="Autres articles" className="mt-12">
          <h2 className="mb-4 font-heading text-lg font-semibold">À lire aussi</h2>
          <ul className="space-y-3">
            {others.map((p) => (
              <li key={p.slug}>
                <Link to={`/blog/${p.slug}`} className="text-accent hover:underline">{p.title}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </article>
    </MarketingLayout>
  );
};

export default BlogArticlePage;
