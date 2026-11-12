import { Link } from "react-router-dom";
import { CalendarDays, Clock, ArrowRight } from "lucide-react";
import MarketingLayout from "@/components/marketing/MarketingLayout";
import Seo from "@/components/marketing/Seo";
import { blogPosts } from "@/content/blog";

const BlogPage = () => (
  <MarketingLayout>
    <Seo
      title="Blog RectorPlus — Gestion scolaire, EdTech et transformation digitale"
      description="Articles et guides sur les logiciels de gestion scolaire, les plateformes universitaires et la transformation digitale de l'éducation en Afrique et en Europe."
      path="/blog"
      jsonLd={[
        {
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "Blog RectorPlus",
          url: "https://rectorplus.com/blog",
          blogPost: blogPosts.map((p) => ({
            "@type": "BlogPosting",
            headline: p.title,
            datePublished: p.date,
            url: `https://rectorplus.com/blog/${p.slug}`,
          })),
        },
      ]}
    />

    <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <p className="mb-4 inline-flex rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
        Ressources
      </p>
      <h1 className="mb-4 font-heading text-4xl font-bold tracking-tight sm:text-5xl">Blog RectorPlus</h1>
      <p className="mb-12 max-w-2xl text-lg text-muted-foreground">
        Guides pratiques sur la gestion scolaire numérique, le choix d'un school management system et la transformation digitale des établissements.
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        {blogPosts.map((post) => (
          <article key={post.slug} className="premium-card flex flex-col p-5 sm:p-7">
            <div className="mb-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                <time dateTime={post.date}>{new Date(post.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</time>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" aria-hidden="true" /> {post.readingTime}
              </span>
              <span className="rounded-full border border-border/60 px-2 py-0.5 uppercase">{post.lang}</span>
            </div>
            <h2 className="mb-3 font-heading text-xl font-semibold leading-snug">
              <Link to={`/blog/${post.slug}`} className="hover:text-accent">{post.title}</Link>
            </h2>
            <p className="mb-6 flex-1 text-sm leading-relaxed text-muted-foreground">{post.excerpt}</p>
            <Link to={`/blog/${post.slug}`} className="inline-flex items-center gap-2 text-sm font-medium text-accent hover:underline">
              Lire l'article <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </article>
        ))}
      </div>
    </section>
  </MarketingLayout>
);

export default BlogPage;
