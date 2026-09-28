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
    expect(links[0].textContent).toContain("Chat on WhatsApp");
  });

  it("names the WhatsApp number for screen reader and hover users", () => {
    renderFooter();
    const link = screen.getAllByRole("link", { name: /whatsapp/i })[0];
    expect(link).toHaveAttribute(
      "aria-label",
      "Chat with us on WhatsApp at +234 814 279 7233",
    );
    expect(link).toHaveAttribute("title", "+234 814 279 7233");
  });

  it("offers a labelled email contact", () => {
    renderFooter();
    const link = screen.getByRole("link", { name: /email us at/i });
    expect(link.getAttribute("href")).toBe(
      "mailto:abdullahimusliudeen@gmail.com",
    );
  });

  it("gives the logged out landing page labelled navigation landmarks", () => {
    renderFooter({ isPublic: true });
    ["Start learning", "Algorise Tech Explorers"].forEach((name) => {
      expect(
        screen.getByRole("navigation", { name: `${name} links` }),
      ).toBeInTheDocument();
    });
  });

  it("keeps help one tap away for signed in students", () => {
    renderFooter();
    const help = screen.getByRole("navigation", { name: "Help and feedback" });
    expect(help).toBeInTheDocument();
    expect(within(help).getByRole("link", { name: "Help and FAQ" })).toHaveAttribute(
      "href",
      "/academy/faq",
    );
    expect(within(help).getByRole("link", { name: "Live classroom" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Learn links" })).not.toBeInTheDocument();
  });

  it("does not send a logged out visitor to pages that need a session", () => {
    renderFooter({ isPublic: true });
    const help = screen.getByRole("navigation", { name: "Help and feedback" });
    expect(within(help).getByRole("link", { name: "Help and FAQ" })).toBeInTheDocument();
    expect(within(help).queryByRole("link", { name: "Live classroom" })).not.toBeInTheDocument();
    expect(within(help).queryByRole("link", { name: "Notifications" })).not.toBeInTheDocument();
  });

  it("centres the footer content", () => {
    const { container } = renderFooter();
    const panel = container.querySelector("footer > div");
    expect(panel.className).toContain("text-center");
    expect(panel.className).toContain("mx-auto");
  });

  it("keeps the WhatsApp button and the registration number", () => {
    renderFooter();
    expect(
      screen.getByRole("link", { name: /chat with us on whatsapp/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Algorise Tech Explorers · RC No\. RC-8665201/i),
    ).toBeInTheDocument();
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
      "/academy/faq",
    ]);
    hrefs.forEach((href) => expect(valid.has(href)).toBe(true));
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("is a single contentinfo landmark branded for the organisation", () => {
    const { container } = renderFooter();
    expect(container.querySelectorAll("footer")).toHaveLength(1);
    expect(
      screen.getByText("Algorise Tech Explorers", { selector: "p" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(`© ${new Date().getFullYear()}`)),
    ).toBeInTheDocument();
  });

  it("never presents the Academy under the old Muwatta Academy name", () => {
    const { container } = renderFooter();
    expect(container.textContent).not.toMatch(/Muwatta Academy/i);
    expect(container.textContent).not.toMatch(/ATE Academy/i);
  });

  it("keeps the WhatsApp contact on the logged out landing page", () => {
    renderFooter({ isPublic: true });
    const whatsapp = screen.getAllByRole("link", { name: /whatsapp/i })[0];
    expect(whatsapp.getAttribute("href")).toMatch(
      /^https:\/\/wa\.me\/2348142797233\?text=/,
    );
    expect(whatsapp).toHaveAttribute(
      "aria-label",
      "Chat with us on WhatsApp at +234 814 279 7233",
    );
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
