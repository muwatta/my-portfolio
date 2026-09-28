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

// The footer's content panel, found by its padding rather than by position,
// because the first child is a decorative brand accent.
function bodyPanel(container) {
  return [...container.querySelectorAll("footer div")].find((node) =>
    /pb-|safe-area/.test(node.className ?? ""),
  );
}

describe("AcademyFooter", () => {
  it("is a single contentinfo landmark", () => {
    const { container } = renderFooter();
    expect(container.querySelectorAll("footer")).toHaveLength(1);
    expect(
      screen.getByRole("contentinfo", { name: /academy footer/i }),
    ).toBeInTheDocument();
  });

  it("keeps the WhatsApp contact on the Academy number", () => {
    renderFooter();
    const link = screen.getByRole("link", { name: /whatsapp/i });
    expect(link.getAttribute("href")).toMatch(
      /^https:\/\/wa\.me\/2348142797233\?text=/,
    );
    // The number is shown in text as well as the accessible name, so nobody has
    // to long press to find out what it is.
    expect(link).toHaveTextContent("+234 814 279 7233");
    expect(link).toHaveAttribute(
      "aria-label",
      "Chat with us on WhatsApp at +234 814 279 7233",
    );
  });

  it("opens WhatsApp in a new tab without leaking the opener", () => {
    renderFooter();
    const link = screen.getByRole("link", { name: /whatsapp/i });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("keeps the email contact with a subject already filled in", () => {
    renderFooter();
    const link = screen.getByRole("link", { name: /email us at/i });
    expect(link.getAttribute("href")).toMatch(
      /^mailto:abdullahimusliudeen@gmail\.com\?subject=/,
    );
    expect(link).toHaveTextContent("abdullahimusliudeen@gmail.com");
  });

  it("gives every contact card and question a comfortable tap target", () => {
    const { container } = renderFooter();
    // WCAG 2.2 asks for 24px minimum, the comfortable figure is 44px, and the
    // phone is the primary device for the Academy.
    const cards = [...container.querySelectorAll("footer a")];
    expect(cards.length).toBeGreaterThan(0);
    cards.forEach((card) => {
      expect(card.className).toMatch(/min-h-(11|12|14)/);
    });
    [...container.querySelectorAll("footer summary")].forEach((summary) => {
      expect(summary.className).toMatch(/min-h-(11|12|14)/);
    });
  });

  it("shows short answers as collapsed dropdowns", () => {
    const { container } = renderFooter();
    const questions = container.querySelectorAll("details");
    expect(questions.length).toBeGreaterThanOrEqual(4);
    questions.forEach((question) => {
      expect(question.hasAttribute("open")).toBe(false);
      expect(question.querySelector("summary")?.textContent?.trim()).toBeTruthy();
    });
  });

  it("keeps only one short answer open at a time", () => {
    // The shared name attribute is the native exclusive accordion, so opening
    // one collapses the rest and the page never grows without bound.
    const { container } = renderFooter();
    const names = [...container.querySelectorAll("details")].map((node) =>
      node.getAttribute("name"),
    );
    expect(names.every((name) => name === "academy-footer-faq")).toBe(true);
  });

  it("points at the full FAQ page for anything more", () => {
    renderFooter();
    expect(
      screen.getByRole("link", { name: /see all questions and answers/i }),
    ).toHaveAttribute("href", "/academy/faq");
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

  it("respects a reduced motion preference", () => {
    const { container } = renderFooter();
    // The chevron rotates on open, so the transition must be droppable.
    expect(container.innerHTML).toMatch(/motion-reduce:transition-none/);
  });

  it("leaves room for the bottom tab bar and the home indicator", () => {
    const { container } = renderFooter();
    // Signed in, the fixed tab bar sits over the footer on a phone.
    expect(bodyPanel(container).className).toMatch(/pb-24/);
  });

  it("leaves the same room on the public page, which has no tab bar", () => {
    const { container } = renderFooter({ isPublic: true });
    expect(bodyPanel(container).className).toMatch(/safe-area-inset-bottom/);
    expect(bodyPanel(container).className).not.toMatch(/pb-24/);
  });

  it("keeps the same short answers for a visitor who is not signed in", () => {
    const { container, unmount } = renderFooter();
    const signedIn = container.querySelectorAll("details").length;
    unmount();

    renderFooter({ isPublic: true });
    expect(screen.getAllByRole("group").length).toBeGreaterThanOrEqual(
      signedIn,
    );
  });

  it("never presents the Academy under the old name", () => {
    const { container } = renderFooter();
    expect(container.textContent).not.toMatch(/Muwatta Academy/i);
    expect(container.textContent).not.toMatch(/ATE Academy/i);
  });

  it("only links to routes that exist in the Academy", () => {
    const { container } = renderFooter();
    const known = new Set([
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
    const hrefs = [...container.querySelectorAll("a[href]")]
      .map((node) => node.getAttribute("href"))
      .filter((href) => href.startsWith("/"));
    expect(hrefs.length).toBeGreaterThan(0);
    hrefs.forEach((href) => expect(known.has(href)).toBe(true));
  });
});
