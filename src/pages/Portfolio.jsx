import AnimatedBackground from "../components/layout/AnimatedBackground";
import Seo from "../components/seo/Seo";
import { PAGE_SEO } from "../data/pageSeo";
import { Hero, ProjectGrid } from "../features/portfolio";
import { useEffect, useState } from "react";
import { fetchProjects } from "../lib/projects";

export default function Portfolio() {
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchProjects()
      .then(setProjects)
      .catch(() => setError("Projects are temporarily unavailable."));
  }, []);

  return (
    <>
      <Seo
        {...PAGE_SEO["/portfolio"]}
        path="/portfolio"
        type="website"
      />

      <div className="relative min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 selection:bg-blue-500/30 transition-colors duration-300">
        <AnimatedBackground />
        <main className="relative z-10">
          <Hero />
          {error ? (
            <p className="px-4 py-16 text-center text-sm text-red-400">
              {error}
            </p>
          ) : projects ? (
            <ProjectGrid projects={projects} />
          ) : (
            <p className="px-4 py-16 text-center text-sm text-slate-500">
              Loading projects...
            </p>
          )}
        </main>
      </div>
    </>
  );
}
