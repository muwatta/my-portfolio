import { useEffect } from "react";

const PORTFOLICO_ICON = "/images/favicon-32x32.png";
const ACADEMY_ICONS = [
  { rel: "icon", type: "image/png", sizes: "32x32", href: "/images/ate-favicon-32.png" },
  { rel: "icon", type: "image/png", sizes: "192x192", href: "/images/ate-icon-192.png" },
  { rel: "apple-touch-icon", href: "/images/ate-icon-192.png" },
];

const DESKTOP_ICON = { rel: "icon", type: "image/png", href: PORTFOLICO_ICON };

const applyIcons = (definitions) => {
  const head = document.head;
  head.querySelectorAll("[data-favicon-managed]").forEach((node) => {
    node.remove();
  });

  const apple = document.querySelector(
    'link[rel="apple-touch-icon"]:not([data-favicon-managed])',
  );

  definitions.forEach((definition) => {
    const link = document.createElement("link");
    link.setAttribute("rel", definition.rel);
    if (definition.type) link.setAttribute("type", definition.type);
    if (definition.sizes) link.setAttribute("sizes", definition.sizes);
    link.setAttribute("href", definition.href);
    link.setAttribute("data-favicon-managed", "true");
    head.appendChild(link);
  });

  if (apple) apple.setAttribute("href", definitions.at(-1)?.href ?? PORTFOLICO_ICON);
};

export function useAcademyFavicon(isAcademyRoute) {
  useEffect(() => {
    applyIcons(isAcademyRoute ? ACADEMY_ICONS : [DESKTOP_ICON]);
  }, [isAcademyRoute]);
}
