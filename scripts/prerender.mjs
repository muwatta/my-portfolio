import { readFile, writeFile, mkdir } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router";
import { createServer } from "vite";
import { fetchPublicCourses, courseDescription } from "./lib/academy-catalogue.mjs";
import { ACADEMY, academyCourseTitle } from "../src/data/academy.js";
import { PAGE_SEO } from "../src/data/pageSeo.js";
import { projects } from "../src/data/projects.js";
import { breadcrumbSchema, pageUrl, absoluteUrl } from "../src/lib/seo.js";

const rootDir = dirname(fileURLToPath(import.meta.url));
const projectDir = dirname(rootDir);
const distDir = join(projectDir, "dist");

const SITE_URL = "https://www.muwatta.com.ng";

const publicRoutes = [
  {
    path: "/",
    title:
      "Muwatta | Abdullahi Musliudeen — Software Engineer, Technology Educator & Builder",
    description:
      "Portfolio of Abdullahi Musliudeen, a Nigerian software engineer, technology educator, and builder working across backend systems, React, embedded systems, AI, and IoT.",
    h1: "Abdullahi Musliudeen",
  },
  // The marketing pages take their copy from src/data/pageSeo.js, which the page
  // components also use, so the prerendered head and the live head cannot
  // disagree. They did once: the prerender was serving "Resume" and a
  // 31-character description, and the title changed the moment JavaScript ran.
  ...Object.entries(PAGE_SEO).map(([path, seo]) => ({ path, ...seo })),
  // The academy landing page and its FAQ are the public face of the academy.
  // They have to be prerendered: any path with no file of its own is served
  // index.html, and index.html carries the homepage's canonical URL, which tells
  // Google to drop the requested page and index the homepage instead. That is
  // exactly why the academy was not appearing in search.
  {
    path: ACADEMY.path,
    title: `${ACADEMY.name} | Learn Programming, C++ and AI Online`,
    description: `${ACADEMY.name} teaches Python for AI and machine learning and C++ for embedded systems through weekly lessons, graded exercises, and projects you build as you learn.`,
    h1: ACADEMY.name,
    intro:
      "Learn Python for AI and machine learning or C++ for embedded systems, with weekly lessons, exercises graded as you go, and projects you finish by building something real.",
  },
  {
    path: `${ACADEMY.path}/faq`,
    title: `Frequently Asked Questions | ${ACADEMY.name}`,
    description: `Answers about ${ACADEMY.name} courses, weekly structure, exercises, grading, hardware requirements, and how to get started.`,
    h1: "Frequently asked questions",
    intro: `How ${ACADEMY.name} courses are structured, what you need to get started, and how the exercises are graded.`,
  },
  // The course catalogue. It was rendering the Portfolio page, so /courses was a
  // duplicate of /portfolio under a course URL and listed no courses at all.
  {
    path: ACADEMY.coursesPath,
    title: `Courses | ${ACADEMY.name}`,
    description: `Python for AI and machine learning and C++ for embedded systems at ${ACADEMY.name}, with weekly lessons, graded exercises, and projects.`,
    h1: "Courses",
    intro:
      "Every course runs in weekly lessons with exercises that are graded as you go.",
  },
];

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// The content pages: one per project and one per published post.
//
// These were the last routes still being served index.html, which carries the
// homepage's canonical and title. Nine project pages and six blog posts were in
// the sitemap telling Google to index them while the page itself said "this is
// really the homepage", so Google was told to drop all fifteen. Nothing errored;
// the sitemap and the served HTML simply disagreed.
//
// Titles and descriptions are read from the same fields the page components use,
// so the prerendered head and the live head cannot drift.

const blogPosts = () => {
  const posts = JSON.parse(
    readFileSync(join(projectDir, "public", "blog.json"), "utf8"),
  );
  // The same filter build-sitemap applies, so the two cannot disagree about
  // which posts are indexable.
  return posts.filter(
    (post) => post.published !== false && post.id != null && post.title && post.excerpt,
  );
};

const projectRoutes = () =>
  projects.map((project) => ({
    path: `/portfolio/${project.id}`,
    title: project.seoTitle || `${project.title} | Muwatta`,
    description:
      project.seoDescription || project.shortDescription || project.description,
    image: project.imageUrl || project.image,
    canonicalUrl: project.canonicalUrl || undefined,
    type: "article",
    h1: project.title,
  }));

const postRoutes = () =>
  blogPosts().map((post) => ({
    path: `/blog/${post.id}`,
    title: `${post.title} | Abdullahi Musliudeen`,
    description: post.excerpt,
    type: "article",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        "@id": `${pageUrl(`/blog/${post.id}`)}#article`,
        headline: post.title,
        description: post.excerpt,
        url: pageUrl(`/blog/${post.id}`),
        mainEntityOfPage: pageUrl(`/blog/${post.id}`),
        ...(post.image ? { image: absoluteUrl(post.image) } : {}),
        author: {
          "@type": "Person",
          name: "Abdullahi Oladipupo Musliudeen",
          url: pageUrl("/about"),
        },
        datePublished: post.date,
        publisher: { "@type": "Person", name: "Abdullahi Oladipupo Musliudeen" },
      },
      breadcrumbSchema([
        { name: "Home", path: "/" },
        { name: "Writing", path: "/blog" },
        { name: post.title, path: `/blog/${post.id}` },
      ]),
    ],
    h1: post.title,
  }));

// A static shell written into #root, which createRoot replaces on hydration.
// It exists so a crawler that does not run JavaScript still finds text and,
// more importantly, a link graph. The anchor text is descriptive on purpose:
// the brand name tells a crawler what the target page is, "click here" does not.
const shellNav = [
  { href: "/", label: "Home" },
  { href: "/portfolio", label: "Work" },
  { href: "/courses", label: "Courses" },
  { href: ACADEMY.path, label: ACADEMY.name },
  { href: "/blog", label: "Writing" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

const renderShell = (route) => {
  const links = shellNav
    .map(
      (item) =>
        `      <li><a href="${SITE_URL}${item.href}">${escapeHtml(item.label)}</a></li>`,
    )
    .join("\n");

  const intro = route.intro
    ? `\n    <p>${escapeHtml(route.intro)}</p>`
    : "";

  return `<div class="prerender-shell">
    <header>
    <a href="${SITE_URL}/">${SITE_URL.replace(/^https?:\/\//, "")}</a>
      <nav aria-label="Primary">
    <ul>
${links}
    </ul>
      </nav>
    </header>
    <main id="main-content">
      <h1>${escapeHtml(route.h1 || route.title)}</h1>
    <p>${escapeHtml(route.description)}</p>${intro}${route.body || ""}
    </main>
  </div>`;
};

const stripRouteSensitiveHead = (html) =>
  html
    .replace(/\s*<title>[\s\S]*?<\/title>/i, "")
    .replace(/\s*<meta[^>]*data-rh="true"[^>]*\/?>/gi, "")
    .replace(/\s*<link[^>]*data-rh="true"[^>]*\/?>/gi, "")
    .replace(
      /\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/gi,
      "",
    );

const renderRoute = async (HelmetProvider, Seo, route) => {
  const helmetContext = {};
  renderToStaticMarkup(
    React.createElement(
      HelmetProvider,
      { context: helmetContext },
      React.createElement(
        StaticRouter,
        { location: route.path },
        React.createElement(Seo, {
          title: route.title,
          description: route.description,
          path: route.path,
          jsonLd: route.jsonLd,
          type: route.type,
          image: route.image,
          canonicalUrl: route.canonicalUrl,
        }),
      ),
    ),
  );

  const { helmet } = helmetContext;
  return [
    helmet.title.toString(),
    helmet.meta.toString(),
    helmet.link.toString(),
    helmet.script.toString(),
  ]
    .filter(Boolean)
    .join("\n    ");
};

const routeOutputPath = (route) =>
  route.path === "/"
    ? join(distDir, "index.html")
    : join(distDir, route.path.slice(1), "index.html");

/**
 * Put the prerendered head and shell into the built template.
 *
 * The shell goes inside #root, so createRoot throws it away and renders the real
 * React app. Nothing user-visible depends on it staying.
 */
const buildPage = (template, head, shell) =>
  stripRouteSensitiveHead(template)
    .replace("</head>", `    ${head}\n  </head>`)
    .replace(
      '<div id="root"></div>',
      `<div id="root">\n    ${shell}\n  </div>`,
    );

const vite = await createServer({
  root: projectDir,
  server: { middlewareMode: true },
  appType: "custom",
  ssr: { noExternal: ["react-helmet-async"] },
});

try {
  const [{ default: Seo }, { HelmetProvider }] = await Promise.all([
    vite.ssrLoadModule("/src/components/seo/Seo.jsx"),
    vite.ssrLoadModule("/node_modules/react-helmet-async/lib/index.esm.js"),
  ]);
  const template = await readFile(join(distDir, "index.html"), "utf8");

  // Only the published Academy catalogue is a public course offering.
  const academyCourses = await fetchPublicCourses(projectDir);

  const courseRoutes = [
    ...academyCourses.map((course) => ({
      path: `/courses/${course.slug}`,
      title: academyCourseTitle(course.title),
      description: courseDescription(course),
      h1: course.title,
      intro: courseDescription(course),
    })),
  ];

  const routes = [
    ...publicRoutes,
    ...courseRoutes,
    ...projectRoutes(),
    ...postRoutes(),
  ];
  const seen = new Set();
  const uniqueRoutes = routes.filter((route) => {
    if (seen.has(route.path)) return false;
    seen.add(route.path);
    return true;
  });

  for (const route of uniqueRoutes) {
    const head = await renderRoute(HelmetProvider, Seo, route);
    const page = buildPage(template, head, renderShell(route));
    const outputPath = routeOutputPath(route);
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, page);
  }

  console.log(
    `Prerendered ${uniqueRoutes.length} routes (${academyCourses.length} live academy courses).`,
  );
} finally {
  await vite.close();
}
