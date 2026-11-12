import { Helmet } from "react-helmet-async";

const SITE = "https://rectorplus.com";
const OG_IMAGE =
  "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/8c62c609-661b-4cb7-a063-30090906fa8e/id-preview-a1a3c0cd--a2534cfe-b45d-4362-9a6b-e08e73555ebf.lovable.app-1773566364198.png";

interface SeoProps {
  title: string;
  description: string;
  path: string;
  /** Extra JSON-LD blocks (Article, FAQPage, BreadcrumbList...) */
  jsonLd?: Record<string, unknown>[];
  type?: "website" | "article";
}

/** Balises head par page : title, description, canonical, Open Graph, Twitter Cards, JSON-LD. */
const Seo = ({ title, description, path, jsonLd = [], type = "website" }: SeoProps) => {
  const url = `${SITE}${path}`;
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta name="robots" content="index, follow, max-image-preview:large" />

      <meta property="og:type" content={type} />
      <meta property="og:site_name" content="RectorPlus" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={OG_IMAGE} />
      <meta property="og:locale" content="fr_FR" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@Rectorplus" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={OG_IMAGE} />

      {jsonLd.map((block, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(block)}
        </script>
      ))}
    </Helmet>
  );
};

export { SITE, OG_IMAGE };
export default Seo;
