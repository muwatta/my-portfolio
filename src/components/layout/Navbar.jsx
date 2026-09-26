import { useState, useEffect, useRef, useCallback } from "react";
import { Link, NavLink } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FiMenu, FiX } from "react-icons/fi";
import { HiSun, HiMoon } from "react-icons/hi";
import { navItems } from "../../data/navigation";
import { useTheme } from "../../context/useTheme";

const MotionLink = motion.create(Link);
const MotionNavLink = motion.create(NavLink);

function ThemeToggle({ className = "" }) {
  const { theme, toggle } = useTheme();

  return (
    <motion.button
      onClick={toggle}
      whileTap={{ scale: 0.9 }}
      whileHover={{ scale: 1.1 }}
      className={`flex items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-600 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:border-blue-500/50 ${className}`}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      aria-pressed={theme === "dark"}
    >
      <AnimatePresence mode="wait">
        {theme === "dark" ? (
          <motion.div
            key="sun"
            initial={{ rotate: -90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: 90, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <HiSun size={16} />
          </motion.div>
        ) : (
          <motion.div
            key="moon"
            initial={{ rotate: 90, opacity: 0 }}
            animate={{ rotate: 0, opacity: 1 }}
            exit={{ rotate: -90, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <HiMoon size={16} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

function NavBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const menuRef = useRef(null);
  const toggleRef = useRef(null);

  const closeMenu = useCallback(() => setIsOpen(false), []);

  // Handle scroll events
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Handle mobile menu state and keyboard
  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        toggleRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  // Close menu on resize to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768 && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isOpen]);

  const menuVariants = {
    closed: {
      opacity: 0,
      height: 0,
      transition: { duration: 0.3, ease: "easeIn" },
    },
    open: {
      opacity: 1,
      height: "auto",
      transition: { duration: 0.4, ease: "easeOut" },
    },
  };

  const itemVariants = {
    closed: { opacity: 0, x: -20 },
    open: { opacity: 1, x: 0 },
  };

  return (
    <motion.nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-slate-200/50 bg-white/90 shadow-sm backdrop-blur-md dark:border-slate-800/50 dark:bg-slate-950/90"
          : "bg-transparent"
      }`}
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6 }}
    >
      {/* Navbar container */}
      <div className="mx-auto w-full px-4 sm:px-6 lg:px-8">
        <div className="flex h-20 items-center justify-between">
          {/* Logo */}
          <MotionLink
            to="/"
            className="shrink-0"
            aria-label="Muwatta home"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <span className="bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-2xl font-bold text-transparent">
              Muwatta
            </span>
          </MotionLink>

          {/* Desktop Navigation - hidden on mobile, shown from md breakpoint */}
          <div className="hidden gap-8 md:flex md:items-center">
            {navItems.map((item, i) => (
              <MotionNavLink
                key={item.name}
                to={item.path}
                className={({ isActive }) =>
                  `relative py-2 text-sm font-medium transition-colors duration-300 ${
                    item.name === "Let's Talk"
                      ? "rounded-full bg-blue-600/10 px-4 text-blue-700 shadow-sm shadow-blue-500/10 dark:text-blue-300"
                      : isActive
                        ? "text-slate-900 dark:text-white"
                        : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  }`
                }
              >
                {({ isActive }) => (
                  <motion.span
                    className="inline-block"
                    whileHover={{
                      y: -2,
                      scale: item.name === "Let's Talk" ? 1.05 : 1,
                    }}
                    whileTap={{ scale: 0.95 }}
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                  >
                    {item.name}
                    {item.name !== "Let's Talk" && (
                      <motion.span
                        className="absolute -bottom-1 left-0 h-0.5 rounded-full bg-blue-500"
                        initial={{ width: 0 }}
                        animate={{ width: isActive ? "100%" : 0 }}
                        whileHover={{ width: "100%" }}
                        transition={{ duration: 0.3 }}
                      />
                    )}
                  </motion.span>
                )}
              </MotionNavLink>
            ))}

            <ThemeToggle className="h-9 w-9" />
          </div>

          {/* Mobile Controls - shown on mobile, hidden from md breakpoint */}
          <div className="flex items-center gap-2 md:hidden">
            <ThemeToggle className="h-9 w-9" />

            <motion.button
              ref={toggleRef}
              onClick={() => setIsOpen(!isOpen)}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100 dark:text-white dark:hover:bg-slate-800/50"
              whileTap={{ scale: 0.9 }}
              aria-label={isOpen ? "Close menu" : "Open menu"}
              aria-expanded={isOpen}
              aria-controls="mobile-menu"
            >
              <AnimatePresence mode="wait">
                {isOpen ? (
                  <motion.div
                    key="close"
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                  >
                    <FiX size={24} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="menu"
                    initial={{ rotate: 90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: -90, opacity: 0 }}
                  >
                    <FiMenu size={24} />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isOpen && (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-slate-950/40 md:hidden"
            aria-label="Close menu"
            onClick={closeMenu}
          />
        )}
      </AnimatePresence>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="mobile-menu"
            ref={menuRef}
            className="absolute left-0 right-0 top-full border-b border-slate-200/50 bg-white/95 backdrop-blur-xl dark:border-slate-800/50 dark:bg-slate-950/95 md:hidden"
            initial="closed"
            animate="open"
            exit="closed"
            variants={menuVariants}
          >
            <div className="mx-auto w-full px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4 sm:px-6">
              <div className="space-y-1">
                {navItems.map((item) => (
                  <motion.div key={item.name} variants={itemVariants}>
                    <NavLink
                      to={item.path}
                      onClick={closeMenu}
                      className={({ isActive }) =>
                        `block rounded-xl px-4 py-3 text-base font-medium transition-all ${
                          item.name === "Let's Talk"
                            ? "border border-blue-500/30 bg-blue-600/10 text-blue-700 dark:text-blue-300"
                            : isActive
                              ? "border border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                              : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-white"
                        }`
                      }
                    >
                      {item.name}
                    </NavLink>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
}

export default NavBar;
