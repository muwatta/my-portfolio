import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router";
import { createServer } from "vite";
import { fetchPublicCourses, courseDescription } from "./lib/academy-catalogue.mjs";
import { ACADEMY, academyCourseTitle } from "../src/data/academy.js";
import { PAGE_SEO } from "../src/data/pageSeo.js";

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
    description: `${ACADEMY.name} is an online tech school teaching Python, C++ for embedded systems, and the terminal, with weekly lessons, graded exercises, and projects you build as you learn.`,
    h1: ACADEMY.name,
    intro:
      "Learn programming, C++ and embedded systems, and the terminal, with weekly lessons, exercises that are graded as you go, and projects you finish by building something real.",
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
    description: `Programming, C++ and embedded systems, and terminal courses taught at ${ACADEMY.name}, with weekly lessons, graded exercises, and projects.`,
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
  const [{ default: Seo }, { courses }, { HelmetProvider }] = await Promise.all([
    vite.ssrLoadModule("/src/components/seo/Seo.jsx"),
    vite.ssrLoadModule("/src/data/courses.js"),
    vite.ssrLoadModule("/node_modules/react-helmet-async/lib/index.esm.js"),
  ]);
  const template = await readFile(join(distDir, "index.html"), "utf8");

  // The marketing courses in src/data, plus the live academy catalogue, so both
  // sets of course pages exist as files and neither is served the homepage's
  // canonical.
  const academyCourses = await fetchPublicCourses(projectDir);

  const courseRoutes = [
    ...courses.map((course) => ({
      path: `/courses/${course.slug}`,
      title: course.title,
      description: course.description,
      h1: course.title,
    })),
    ...academyCourses.map((course) => ({
      path: `/courses/${course.slug}`,
      title: academyCourseTitle(course.title),
      description: courseDescription(course),
      h1: course.title,
      intro: courseDescription(course),
    })),
  ];

  const routes = [...publicRoutes, ...courseRoutes];
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
