// @vitest-environment node
//
// Why this file exists: the academy was absent from Google and nothing failed.
//
// vercel.json serves index.html for any path with no file of its own, and
// index.html carries the homepage's canonical URL. Every route that was not
// prerendered therefore answered a crawler with "this page is really the
// homepage", and Google did exactly what it was told: dropped it. No build
// error, no test failure, no console message. It just quietly did not rank.
//
// So these assertions are about the shape of the built output, not about React.

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import process from "node:process";
import { join } from "node:path";

const root = process.cwd();
const dist = join(root, "dist");
const built = existsSync(dist);

const read = (relative) => readFileSync(join(dist, relative), "utf8");
const routeFile = (route) =>
  route === "/" ? "index.html" : `${route.replace(/^\//, "")}/index.html`;

/** The routes that must exist as their own file, or they get the homepage's canonical. */
const PUBLIC_ROUTES = [
  "/",
  "/about",
  "/portfolio",
  "/blog",
  "/contact",
  "/now",
  "/resume",
  "/skills",
  "/engineering-experience",
  "/courses",
  "/academy",
  "/academy/faq",
];

const meta = (html, name) => {
  const match = html.match(
    new RegExp(`<meta[^>]*name="${name}"[^>]*content="([^"]*)"`),
  );
  return match ? match[1] : null;
};

const canonical = (html) => {
  const match = html.match(/<link[^>]*rel="canonical"[^>]*href="([^"]+)"/);
  return match ? match[1] : null;
};

const title = (html) => {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/);
  return match ? match[1].replace(/\s+/g, " ").trim() : null;
};

const suite = built ? describe : describe.skip;

suite("every public route is its own file", () => {
  it.each(PUBLIC_ROUTES)("%s has a prerendered file", (route) => {
    // The whole bug. If this file is missing, the host serves the homepage and
    // the page is told to consolidate into it.
    expect(existsSync(join(dist, routeFile(route)))).toBe(true);
  });

  it.each(PUBLIC_ROUTES)("%s has a self-referencing canonical", (route) => {
    const expected =
      route === "/" ? "https://www.muwatta.com.ng/" : `https://www.muwatta.com.ng${route}`;
    expect(canonical(read(routeFile(route)))).toBe(expected);
  });

  it.each(PUBLIC_ROUTES)("%s is indexable", (route) => {
    const html = read(routeFile(route));
    expect(html).not.toMatch(/noindex/);
    expect(meta(html, "robots")).toMatch(/index/);
  });

  it.each(PUBLIC_ROUTES)("%s has a title and a description", (route) => {
    const html = read(routeFile(route));
    expect(title(html)).toBeTruthy();
    expect(meta(html, "description")?.length).toBeGreaterThan(50);
  });
});

suite("the academy is reachable and describes itself", () => {
  it("names the academy in the /academy title", () => {
    expect(title(read("academy/index.html"))).toContain("Algorise Tech Explorers");
  });

  it("is linked from the served HTML of the homepage", () => {
    // Crawlers that do not run JavaScript see only this. The nav link in the
    // React bundle is invisible to them, which is why the link has to be in the
    // prerendered shell as well.
    expect(read("index.html")).toMatch(/href="https:\/\/www\.muwatta\.com\.ng\/academy"/);
  });

  it("is linked from every public page, not just the homepage", () => {
    for (const route of PUBLIC_ROUTES) {
      expect(read(routeFile(route))).toMatch(/href="https:\/\/www\.muwatta\.com\.ng\/academy"/);
    }
  });

  it("uses the brand name as the anchor text", () => {
    // "Muwatta Academy" and "Algorise Tech Explorers" were both in use, which is
    // two names for one entity. A crawler resolves the name it sees.
    const shell = read("index.html");
    expect(shell).toMatch(/href="https:\/\/www\.muwatta\.com\.ng\/academy">Algorise Tech Explorers</);
  });

  it("carries structured data on the academy page", () => {
    expect(read("academy/index.html")).toMatch(/application\/ld\+json/);
  });
});

suite("the sitemap covers the public surface", () => {
  const sitemap = readFileSync(join(root, "public", "sitemap.xml"), "utf8");
  const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

  it("lists the academy landing page and its FAQ", () => {
    expect(locations).toContain("https://www.muwatta.com.ng/academy");
    expect(locations).toContain("https://www.muwatta.com.ng/academy/faq");
  });

  it("lists the course catalogue", () => {
    expect(locations).toContain("https://www.muwatta.com.ng/courses");
  });

  it("lists every location that has a file, and no location without one", () => {
    // A sitemap entry with no file is a 404 for a crawler, and a file missing
    // from the sitemap is the original problem. Both directions matter.
    for (const location of locations) {
      const route = location.replace("https://www.muwatta.com.ng", "") || "/";
      if (location.includes("/blog/") || location.includes("/portfolio/")) continue;
      expect(existsSync(join(dist, routeFile(route)))).toBe(true);
    }
  });

  it("does not list the logged-in app", () => {
    for (const location of locations) {
      expect(location).not.toMatch(/\/academy\/(dashboard|lessons|assignments|teacher|admin)/);
    }
  });
});

suite("robots.txt blocks the app and not the marketing pages", () => {
  const robots = readFileSync(join(root, "public", "robots.txt"), "utf8");

  // Matched as whole lines. A prefix match would make `Disallow: /academy`
  // appear to be present just because `/academy/dashboard` is, and the point of
  // these assertions is which exact paths are blocked.
  const blocked = (path) =>
    robots
      .split(/\r?\n/)
      .some((line) => line.trim().toLowerCase() === `disallow: ${path.toLowerCase()}`);

  it("blocks admin and the api", () => {
    expect(blocked("/admin")).toBe(true);
    expect(blocked("/api/")).toBe(true);
  });

  it("blocks the signed-in academy routes", () => {
    for (const path of [
      "/academy/dashboard",
      "/academy/lessons",
      "/academy/assignments",
      "/academy/teacher",
      "/academy/admin",
    ]) {
      expect(blocked(path)).toBe(true);
    }
  });

  it("does not block the public academy pages", () => {
    // The mistake to avoid: blocking the pages the academy needs indexed.
    expect(blocked("/academy")).toBe(false);
    expect(blocked("/academy/faq")).toBe(false);
    expect(blocked("/courses")).toBe(false);
  });

  it("points at the sitemap", () => {
    expect(robots).toMatch(/Sitemap:\s*https:\/\/www\.muwatta\.com\.ng\/sitemap\.xml/);
  });
});

suite("the academy brand name is consistent", () => {
  const academy = readFileSync(join(root, "src", "data", "academy.js"), "utf8");

  it("is defined once, in a module the build scripts can import", () => {
    expect(academy).toMatch(/name:\s*"Algorise Tech Explorers"/);
  });

  it("is the name the served pages use", () => {
    expect(title(read("academy/index.html"))).toContain("Algorise Tech Explorers");
    expect(read("index.html")).toMatch(/Algorise Tech Explorers/);
  });

  it("does not leak the old name into a title", () => {
    for (const route of PUBLIC_ROUTES) {
      expect(title(read(routeFile(route)))).not.toMatch(/Muwatta Academy/i);
    }
  });
});
