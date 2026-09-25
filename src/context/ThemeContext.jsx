import { useEffect, useState } from "react";
import { ThemeContext } from "./ThemeContextValue";

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(
    () => {
      const stored = localStorage.getItem("theme");
      return stored === "dark" || stored === "light" ? stored : "dark";
    },
  );

  useEffect(() => {
    const root = document.documentElement;

    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggle = () => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  };

  const applyTheme = (nextTheme, storageKey = "theme") => {
    const value = nextTheme === "dark" ? "dark" : "light";
    setTheme(value);
    localStorage.setItem(storageKey, value);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggle, applyTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};
