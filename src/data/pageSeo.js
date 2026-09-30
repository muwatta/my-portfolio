// Per-route title and description, in one place.
//
// These used to live twice: once in each page component, and once in
// scripts/prerender.mjs. They drifted, and the copy that drifted was the
// prerendered one, which is the copy a crawler actually reads. So the prerender
// was serving "Resume" and a 31-character description while the live page said
// something else, and the title visibly changed once JavaScript ran.
//
// Plain data, no import.meta.env, so the build script and the React pages both
// import the same object. Homepage is not here: it comes from SITE in lib/seo.

export const PAGE_SEO = {
  "/portfolio": {
    title: "Work | Abdullahi Musliudeen: Software Developer",
    description:
      "Production systems built by Abdullahi Musliudeen: Django REST APIs, PostgreSQL, Redis, Celery/RabbitMQ, and React, used by real users and delivered to clients.",
    h1: "Selected work",
  },
  "/about": {
    title: "About Abdullahi Musliudeen | Software Developer",
    description:
      "Learn about Abdullahi Musliudeen, a Nigerian software developer building production APIs, Django systems, React applications, and data-driven platforms.",
    h1: "About",
  },
  "/blog": {
    title: "Writing | Abdullahi Musliudeen Oladipupo",
    description:
      "Writing on backend engineering, Django REST Framework, API design, system design, DevOps, React and computer vision.",
    h1: "Writing",
  },
  "/skills": {
    title: "Skills | Abdullahi Musliudeen Oladipupo",
    description:
      "Software Developer: Python, Django, Django REST Framework, PostgreSQL, Redis, Celery, Docker and React.",
    h1: "Skills",
  },
  "/contact": {
    title: "Contact | Abdullahi Musliudeen Oladipupo",
    description:
      "Open to backend & full-stack engineering opportunities. Get in touch with Abdullahi Musliudeen for contract development or full-time work.",
    h1: "Contact",
  },
  "/now": {
    title: "Now | Abdullahi Musliudeen",
    description:
      "What Abdullahi Musliudeen is currently working on and focusing on: backend engineering, the Algorise Tech Explorers academy, and mentoring the next generation of Nigerian developers.",
    h1: "Now",
  },
  "/engineering-experience": {
    title: "Engineering Experience | Abdullahi Musliudeen",
    description:
      "Production systems built, users served, learners mentored. Engineering impact and domain experience from Abdullahi Musliudeen.",
    h1: "Engineering experience",
  },
  "/resume": {
    title: "Resume | Abdullahi Musliudeen",
    description:
      "Resume and CV for Abdullahi Musliudeen: Software Developer building production systems with Django, DRF, PostgreSQL, Redis and React.",
    h1: "Resume",
  },
};
