import { Helmet } from "react-helmet-async";
import { pageUrl, SITE } from "../../lib/seo";

const DEFAULT_PROPS = {
  title: SITE.title,
  description: SITE.description,
  path: "/",
  image: SITE.image,
  type: "website",
  robots: "index, follow",
};

const SOCIAL_CARD_TYPES = {
  website: "summary_large_image",
  article: "summary_large_image",
  blog: "summary_large_image",
};

function validateUrl(url) {
  try {
    new URL(url);
    return url;
  } catch {
    console.warn(`Invalid URL: ${url}`);
    return null;
  }
}

function buildStructuredData(title, description, url, image, type) {
  const baseSchema = {
    "@context": "https://schema.org",
    "@type": type === "article" ? "NewsArticle" : "WebPage",
    name: title,
    description,
    url,
  };

  if (image && validateUrl(image)) {
    baseSchema.image = image;
  }

  if (type === "article") {
    baseSchema.author = {
      "@type": "Person",
      name: "Abdullahi Oladipupo Musliudeen",
    };
    baseSchema.datePublished = new Date().toISOString();
    baseSchema.dateModified = new Date().toISOString();
  }

  return baseSchema;
}

export default function Seo({
  title = DEFAULT_PROPS.title,
  description = DEFAULT_PROPS.description,
  path = DEFAULT_PROPS.path,
  image = DEFAULT_PROPS.image,
  type = DEFAULT_PROPS.type,
  jsonLd,
  canonicalUrl,
  robots = DEFAULT_PROPS.robots,
  locale = SITE.locale,
  children,
}) {
  let url = "";
  try {
    url = pageUrl(path);
  } catch (error) {
    console.error(`Failed to build page URL for path: ${path}`, error);
    url = `${SITE.url}${path}`;
  }

  const canonical = canonicalUrl || url;
  const validatedImage = validateUrl(image) ? image : SITE.image;
  const twitterCard = SOCIAL_CARD_TYPES[type] || "summary_large_image";

  const structuredData =
    jsonLd ||
    buildStructuredData(title, description, url, validatedImage, type);

  return (
    <Helmet>
      <html lang={locale.split("-")[0]} />

      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="author" content="Abdullahi Oladipupo Musliudeen" />
      <meta name="robots" content={robots} />
      <link rel="canonical" href={canonical} />

      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={SITE.name} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={validatedImage} />
      <meta property="og:image:alt" content={`${title} image`} />
      <meta property="og:locale" content={locale} />

      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={validatedImage} />
      {SITE.twitter && (
        <>
          <meta name="twitter:site" content={SITE.twitter} />
          <meta name="twitter:creator" content={SITE.twitter} />
        </>
      )}

      <script type="application/ld+json">
        {JSON.stringify(structuredData)}
      </script>

      {children}
    </Helmet>
  );
}
