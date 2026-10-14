import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const app = readFileSync("src/App.jsx", "utf8");

describe("route-specific startup dependencies", () => {
  it("does not load the motion shell for the Academy login route", () => {
    expect(app).not.toMatch(/import\s+\{\s*MotionConfig\s*\}\s+from\s+["']framer-motion/);
    expect(app).toMatch(
      /const PublicMotionConfig = lazy\(\s*\(\) => import\(["']\.\/components\/layout\/PublicMotionConfig/,
    );
    expect(app).toContain(
      'pathname.replace(/\\/+$/, "") === "/academy/login";',
    );
    expect(app).toMatch(
      /const MotionWrapper = isAcademyLoginRoute \? Fragment : PublicMotionConfig;/,
    );
  });

  it("loads public navigation and footer only when those routes render", () => {
    expect(app).toMatch(
      /const Navbar = lazy\(\(\) => import\(["']\.\/components\/layout\/Navbar/,
    );
    expect(app).toMatch(
      /const Footer = lazy\(\(\) => import\(["']\.\/components\/layout\/Footer/,
    );
    expect(app).toMatch(/isPublicRoute && \(/);
  });
});
