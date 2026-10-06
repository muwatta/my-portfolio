// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const html = readFileSync("index.html", "utf8");
const css = readFileSync("src/index.css", "utf8");

describe("the first page paint has local styling", () => {
  it("styles the prerendered shell before the JavaScript app replaces it", () => {
    expect(html).toMatch(/\.prerender-shell\s*\{/);
    expect(html).toMatch(/\.prerender-shell h1\s*\{/);
    expect(html).toMatch(/#root\s*\{\s*min-height:\s*100vh/);
  });

  it("does not block the application stylesheet on Google Fonts", () => {
    expect(css).not.toMatch(/@import\s+url\(["']https:\/\/fonts\.googleapis\.com/);
    expect(html).toMatch(/rel="preload"\s+as="style"[\s\S]*?fonts\.googleapis\.com/);
    expect(html).toMatch(/this\.rel='stylesheet'/);
    expect(html).toMatch(/rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin/);
  });
});
