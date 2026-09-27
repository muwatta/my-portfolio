import { readFileSync } from "node:fs";
import { render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

const PORTFOLIO_TITLE = "Muwatta | Abdullahi Musliudeen — Software Developer";

let useAcademyBranding;

function Harness({ isAcademyRoute }) {
  useAcademyBranding(isAcademyRoute);
  return null;
}

beforeAll(async () => {
  document.title = PORTFOLIO_TITLE;
  ({ useAcademyBranding } = await import("../hooks/useAcademyBranding"));
});

afterEach(() => {
  document.title = PORTFOLIO_TITLE;
  document
    .querySelectorAll("[data-favicon-managed]")
    .forEach((node) => node.remove());
});

describe("useAcademyBranding", () => {
  it("shows only the organisation name on Academy routes", () => {
    render(<Harness isAcademyRoute />);
    expect(document.title).toBe("Algorise Tech Explorers");
    expect(document.title).not.toContain("Muwatta");
    expect(document.title).not.toContain("Abdullahi");
  });

  it("applies the round ATE icons on Academy routes", () => {
    render(<Harness isAcademyRoute />);
    const managed = [
      ...document.querySelectorAll("[data-favicon-managed]"),
    ].map((node) => node.getAttribute("href"));
    expect(managed).toContain("/images/ate-favicon-32.png");
    expect(managed).toContain("/images/ate-icon-192.png");
  });

  it("restores the portfolio branding outside Academy", () => {
    render(<Harness isAcademyRoute={false} />);
    expect(document.title).toBe(PORTFOLIO_TITLE);
    const managed = [
      ...document.querySelectorAll("[data-favicon-managed]"),
    ].map((node) => node.getAttribute("href"));
    expect(managed).toEqual(["/images/favicon-32x32.png"]);
  });

  it("swaps cleanly when moving between Academy and the portfolio", () => {
    const { rerender } = render(<Harness isAcademyRoute />);
    expect(document.title).toBe("Algorise Tech Explorers");

    rerender(<Harness isAcademyRoute={false} />);
    expect(document.title).toBe(PORTFOLIO_TITLE);

    rerender(<Harness isAcademyRoute />);
    expect(document.title).toBe("Algorise Tech Explorers");
  });

  it("ships the organisation name in the install metadata", () => {
    const manifest = JSON.parse(
      readFileSync("public/manifest.json", "utf8"),
    );
    expect(manifest.name).toBe("Algorise Tech Explorers");
    expect(manifest.short_name).toBe("Algorise Tech Explorers");

    const html = readFileSync("index.html", "utf8");
    expect(html).toContain(
      'name="apple-mobile-web-app-title" content="Algorise Tech Explorers"',
    );
  });

  it("keeps the retired Academy names out of shipped metadata", () => {
    for (const file of ["index.html", "public/offline.html"]) {
      const contents = readFileSync(file, "utf8");
      expect(contents).not.toMatch(/Muwatta Academy/i);
      expect(contents).not.toMatch(/ATE Academy/i);
    }
  });
});
