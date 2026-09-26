import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import AcademyFooter from "../components/academy/AcademyFooter";

function renderFooter(props = {}) {
  return render(
    <MemoryRouter>
      <AcademyFooter {...props} />
    </MemoryRouter>,
  );
}

describe("AcademyFooter", () => {
  it("offers WhatsApp contact using the Academy number", () => {
    renderFooter();
    const links = screen.getAllByRole("link", { name: /whatsapp/i });
    expect(links.length).toBeGreaterThan(0);
    links.forEach((link) => {
      expect(link.getAttribute("href")).toMatch(
        /^https:\/\/wa\.me\/2348142797233\?text=/,
      );
    });
    expect(links.some((l) => l.textContent.includes("+234 814 279 7233"))).toBe(
      true,
    );
  });

  it("exposes labelled navigation landmarks", () => {
    renderFooter();
    ["Learn", "My record"].forEach((name) => {
      expect(
        screen.getByRole("navigation", { name: `${name} links` }),
      ).toBeInTheDocument();
    });
  });

  it("only links to routes that exist in the Academy", () => {
    renderFooter();
    const hrefs = screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"))
      .filter((href) => href && href.startsWith("/"));

    const valid = new Set([
      "/academy/dashboard",
      "/academy/lessons",
      "/academy/practice",
      "/academy/assignments",
      "/academy/projects",
      "/academy/materials",
      "/academy/progress",
      "/academy/leaderboard",
      "/academy/notifications",
      "/academy/profile",
      "/academy/live",
    ]);
    hrefs.forEach((href) => expect(valid.has(href)).toBe(true));
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("is a single contentinfo landmark and credits the organisation", () => {
    const { container } = renderFooter();
    expect(container.querySelectorAll("footer")).toHaveLength(1);
    expect(
      screen.getByText(/Algorise Tech Explorers · RC No\. RC-8665201/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(`© ${new Date().getFullYear()}`)),
    ).toBeInTheDocument();
  });

  it("keeps the WhatsApp contact on the logged out landing page", () => {
    renderFooter({ isPublic: true });
    const whatsapp = screen.getByRole("link", { name: /chat on whatsapp/i });
    expect(whatsapp.getAttribute("href")).toMatch(
      /^https:\/\/wa\.me\/2348142797233\?text=/,
    );
    expect(screen.getByText(/\+234 814 279 7233/)).toBeInTheDocument();
  });

  it("shows sign in links, not student links, before logging in", () => {
    renderFooter({ isPublic: true });
    expect(screen.getByRole("link", { name: "Academy login" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Create an account" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Dashboard" }),
    ).not.toBeInTheDocument();
  });
});
