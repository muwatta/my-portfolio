import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { describe, expect, it } from "vitest";
import AcademyFaq from "../pages/AcademyFaq";

// The page sets its own SEO tags, and react-helmet-async needs a provider above
// it. AppShell provides one in the real app, so the test does the same rather
// than rendering a tree that cannot occur.
function renderFaq() {
  return render(
    <HelmetProvider>
      <MemoryRouter>
        <AcademyFaq />
      </MemoryRouter>
    </HelmetProvider>,
  );
}

describe("AcademyFaq", () => {
  it("explains how to use the Academy", () => {
    renderFaq();
    expect(
      screen.getByRole("heading", { name: /how to use the academy/i, level: 1 }),
    ).toBeInTheDocument();
  });

  it("presents every answer as a collapsed dropdown", () => {
    const { container } = renderFaq();
    const questions = container.querySelectorAll("details");
    expect(questions.length).toBeGreaterThan(10);
    questions.forEach((question) => {
      expect(question.hasAttribute("open")).toBe(false);
      expect(question.querySelector("summary")).not.toBeNull();
    });
  });

  it("groups answers under labelled sections", () => {
    renderFaq();
    ["Getting started", "Lessons and practice", "Working offline"].forEach(
      (name) => {
        expect(
          screen.getByRole("heading", { name, level: 2 }),
        ).toBeInTheDocument();
      },
    );
  });

  it("puts direct course, lesson, practice, and live-session routes at the top", () => {
    renderFaq();

    expect(
      screen.getByRole("heading", { name: /find your way around/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /go to courses/i })).toHaveAttribute(
      "href",
      "/academy/courses",
    );
    expect(screen.getByRole("link", { name: /go to learn/i })).toHaveAttribute(
      "href",
      "/academy/lessons",
    );
    expect(screen.getByRole("link", { name: /go to live/i })).toHaveAttribute(
      "href",
      "/academy/live",
    );
    expect(
      screen.getByText(/inside a lesson, use learn for the material, practice/i),
    ).toBeInTheDocument();
  });

  it("filters answers with the search box", () => {
    renderFaq();
    const search = screen.getByLabelText(/search the help topics/i);
    expect(
      screen.getByText(/how do i get an academy account/i),
    ).toBeInTheDocument();

    fireEvent.change(search, { target: { value: "offline" } });

    expect(screen.getByText(/can i learn without internet/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/how do i get an academy account/i),
    ).not.toBeInTheDocument();
  });

  it("offers a way to reach a person when the search finds nothing", () => {
    renderFaq();
    const search = screen.getByLabelText(/search the help topics/i);
    fireEvent.change(search, { target: { value: "zzzznotathing" } });

    expect(screen.getByText(/no answers match that search/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /chat on whatsapp/i }),
    ).toHaveAttribute("href", expect.stringContaining("wa.me/2348142797233"));
  });

  it("keeps the WhatsApp help number in the question support box", () => {
    renderFaq();
    const link = screen.getByRole("link", { name: /chat on whatsapp/i });
    expect(link.getAttribute("href")).toMatch(
      /^https:\/\/wa\.me\/2348142797233\?text=/,
    );
  });

  it("offers a route back to sign in", () => {
    renderFaq();
    const header = screen.getByRole("banner");
    expect(within(header).getByRole("link", { name: /sign in/i })).toHaveAttribute(
      "href",
      "/academy/login",
    );
  });

  it("returns signed-in staff to the page they opened help from", () => {
    render(
      <HelmetProvider>
        <MemoryRouter
          initialEntries={[
            {
              pathname: "/academy/faq",
              state: { returnTo: "/academy/admin" },
            },
          ]}
        >
          <AcademyFaq />
        </MemoryRouter>
      </HelmetProvider>,
    );

    expect(
      screen.getByRole("link", { name: /back to academy/i }),
    ).toHaveAttribute("href", "/academy/admin");
  });

  it("never presents the retired Academy name", () => {
    const { container } = renderFaq();
    expect(container.textContent).not.toMatch(/Muwatta Academy/i);
    expect(container.textContent).not.toMatch(/ATE Academy/i);
  });
});
