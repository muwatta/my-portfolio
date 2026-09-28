import { render, screen, within } from "@testing-library/react";
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

const ACADEMY_ROUTES = new Set([
  "/academy/login",
  "/academy/signup",
  "/academy/faq",
  "/academy/live",
  "/academy/lessons",
  "/academy/assignments",
  "/academy/projects",
  "/academy/materials",
  "/academy/leaderboard",
  "/academy/notifications",
  "/academy/dashboard",
  "/academy/practice",
  "/academy/progress",
  "/academy/profile",
  "/",
]);

describe("AcademyFooter", () => {
  it("is a single contentinfo landmark", () => {
    const { container } = renderFooter();
    expect(container.querySelectorAll("footer")).toHaveLength(1);
    expect(
      screen.getByRole("contentinfo", { name: /academy footer/i }),
    ).toBeInTheDocument();
  });

  it("keeps the WhatsApp button on the Academy number", () => {
    renderFooter();
    const links = screen.getAllByRole("link", { name: /whatsapp/i });
    expect(links.length).toBeGreaterThan(0);
    links.forEach((link) => {
      expect(link.getAttribute("href")).toMatch(
        /^https:\/\/wa\.me\/2348142797233\?text=/,
      );
    });
    const button = links[0];
    expect(button).toHaveAttribute(
      "aria-label",
      "Chat with us on WhatsApp at +234 814 279 7233",
    );
    expect(button).toHaveAttribute("title", "+234 814 279 7233");
    expect(button).toHaveTextContent("Chat on WhatsApp");
  });

  it("keeps the email contact", () => {
    renderFooter();
    expect(
      screen.getByRole("link", { name: /email us at/i }),
    ).toHaveAttribute("href", "mailto:abdullahimusliudeen@gmail.com");
  });

  it("centres the identity block", () => {
    const { container } = renderFooter();
    const identity = container.querySelector("footer h2 + div > div");
    expect(identity.className).toContain("text-center");
  });

  it("organises navigation into labelled groups rather than one list", () => {
    renderFooter();
    ["Quick links", "Support"].forEach((name) => {
      expect(screen.getByRole("navigation", { name })).toBeInTheDocument();
    });
  });

  it("does not repeat the bottom tab bar destinations", () => {
    renderFooter();
    const nav = screen.getByRole("navigation", { name: "Quick links" });
    ["Home", "Learn", "Practice", "My work", "Progress", "Profile"].forEach(
      (tab) => {
        expect(within(nav).queryByRole("link", { name: tab })).not.toBeInTheDocument();
      },
    );
  });

  it("only links to routes that exist", () => {
    renderFooter();
    screen
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"))
      .filter((href) => href && href.startsWith("/"))
      .forEach((href) => expect(ACADEMY_ROUTES.has(href)).toBe(true));
  });

  it("shows the same short answers on every variant", () => {
    ["default", "public"].forEach((variant) => {
      const { container, unmount } = renderFooter(
        variant === "public" ? { isPublic: true } : {},
      );
      const section = screen.getByRole("region", {
        name: /common questions/i,
      });
      const questions = section.querySelectorAll("details");
      expect(questions.length).toBeGreaterThanOrEqual(4);
      questions.forEach((question) => {
        expect(question.hasAttribute("open")).toBe(false);
        expect(question.querySelector("summary")).not.toBeNull();
      });
      expect(container.textContent).not.toMatch(/Muwatta Academy/i);
      unmount();
    });
  });

  it("points at the full FAQ page for anything more", () => {
    renderFooter();
    const link = screen.getByRole("link", {
      name: /see all questions and answers/i,
    });
    expect(link).toHaveAttribute("href", "/academy/faq");
  });

  it("credits the organisation and the registration", () => {
    renderFooter();
    expect(
      screen.getByText(/Algorise Tech Explorers · RC No\. RC-8665201/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(`© ${new Date().getFullYear()}`)),
    ).toBeInTheDocument();
  });

  it("does not send a logged out visitor to pages that need a session", () => {
    renderFooter({ isPublic: true });
    const support = screen.getByRole("navigation", { name: "Support" });
    expect(within(support).queryByRole("link", { name: "Live classroom" })).not.toBeInTheDocument();
    expect(within(support).queryByRole("link", { name: "Notifications" })).not.toBeInTheDocument();
    const quick = screen.getByRole("navigation", { name: "Quick links" });
    expect(within(quick).getByRole("link", { name: "Academy login" })).toBeInTheDocument();
  });

  it("never presents the Academy under the old name", () => {
    const { container } = renderFooter();
    expect(container.textContent).not.toMatch(/Muwatta Academy/i);
    expect(container.textContent).not.toMatch(/ATE Academy/i);
  });
});
