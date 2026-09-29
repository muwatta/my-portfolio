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

  it("still targets the Academy WhatsApp number", () => {
    // The visible text is now just "WhatsApp" on request, so the number only
    // has to be right in the link, which is where it actually matters.
    renderFooter();
    const link = screen.getByRole("link", { name: /whatsapp/i });
    expect(link.getAttribute("href")).toMatch(
      /^https:\/\/wa\.me\/2348142797233\?text=/,
    );
  });

  it("does not print the phone number on the page", () => {
    // Showing it was a deliberate choice once, so this pins the reversal rather
    // than leaving it to drift back by accident.
    const { container } = renderFooter();
    expect(container.textContent).not.toMatch(/\+?234\s?814\s?279\s?7233/);
    expect(container.textContent).not.toMatch(/9142797233/);
  });

  it("opens WhatsApp in a new tab without leaking the opener", () => {
    renderFooter();
    const link = screen.getByRole("link", { name: /whatsapp/i });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("keeps the email link with a subject already filled in", () => {
    renderFooter();
    const link = screen.getByRole("link", { name: /email/i });
    expect(link.getAttribute("href")).toMatch(
      /^mailto:abdullahimusliudeen@gmail\.com\?subject=/,
    );
  });

  it("does not print the email address on the page", () => {
    const { container } = renderFooter();
    expect(container.textContent).not.toMatch(/abdullahimusliudeen@gmail\.com/);
  });

  it("lists the social profiles as external links", () => {
    const { container } = renderFooter();
    const socials = [...container.querySelectorAll('a[href^="https://"]')]
      .filter((link) => /github|linkedin|facebook/.test(link.getAttribute("href")))
      .map((link) => link.getAttribute("href"));
    expect(socials.length).toBeGreaterThan(0);
    container
      .querySelectorAll('a[href^="https://github.com"], a[href^="https://linkedin.com"], a[href^="https://facebook.com"]')
      .forEach((link) => {
        expect(link).toHaveAttribute("target", "_blank");
        expect(link).toHaveAttribute("rel", "noopener noreferrer");
        // No placeholder profile links, which would 404 in front of a student.
        expect(link.getAttribute("href")).not.toMatch(/example|your-|placeholder/i);
      });
  });

  it("gives every link a comfortable tap target", () => {
    const { container } = renderFooter();
    // WCAG 2.2 asks for 24px minimum, the comfortable figure is 44px, and the
    // phone is the primary device for the Academy.
    const links = [...container.querySelectorAll("footer a")];
    expect(links.length).toBeGreaterThan(0);
    links.forEach((link) => {
      expect(link.className).toMatch(/min-h-(11|12|14)/);
    });
  });

  it("offers help and nothing else", () => {
    // Navigation lives in the tab bar and the student nav, so the footer
    // carries no link columns. It is for help, not for duplicating the app.
    const { container } = renderFooter();
    expect(container.querySelectorAll("nav")).toHaveLength(0);
    expect(container.querySelectorAll("details")).toHaveLength(0);
  });

  it("keeps one clear route to the FAQ", () => {
    renderFooter();
    expect(screen.getByRole("link", { name: /read the faq/i })).toHaveAttribute(
      "href",
      "/academy/faq",
    );
  });

  it("no longer lists the student routes", () => {
    const { container } = renderFooter();
    const text = container.textContent;
    for (const label of [
      "Dashboard",
      "Lessons",
      "Practice",
      "Progress",
      "Materials",
      "Live classes",
      "Leaderboard",
    ]) {
      expect(text).not.toMatch(new RegExp(`\\b${label}\\b`));
    }
  });

  it("credits the organisation and the registration", () => {
    renderFooter();
    expect(screen.getByText(/RC No\. RC-8665201/i)).toBeInTheDocument();
    expect(
      screen.getByText("Algorise Tech Explorers", { selector: "p" }),
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

  it("shows the same navigation to a visitor who is not signed in", () => {
    const { container, unmount } = renderFooter();
    const signedIn = container.querySelectorAll("footer a").length;
    unmount();

    const { container: publicContainer } = renderFooter({ isPublic: true });
    expect(publicContainer.querySelectorAll("footer a").length).toBe(
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
