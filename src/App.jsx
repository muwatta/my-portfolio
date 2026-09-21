import { lazy, Suspense, useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { MotionConfig } from "framer-motion";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
import { AcademyAuthProvider } from "./context/AcademyAuthContext";
import PWAInstallPrompt from "./components/PWAInstallPrompt";

import Navbar from "./components/layout/Navbar";
import Footer from "./components/layout/Footer";
import Loader from "./components/layout/Loader";

const Home = lazy(() => import("./pages/Home"));
const Portfolio = lazy(() => import("./pages/Portfolio"));
const ProjectDetail = lazy(() => import("./pages/ProjectDetail"));
const Contact = lazy(() => import("./pages/Contact"));
const About = lazy(() => import("./pages/About"));
const Blog = lazy(() => import("./pages/Blog"));
const BlogPost = lazy(() => import("./pages/BlogPost"));
const Skills = lazy(() => import("./pages/Skills"));
const Now = lazy(() => import("./pages/Now"));
const EngineeringExperience = lazy(
  () => import("./pages/EngineeringExperience"),
);

const Resume = lazy(() => import("./pages/Resume"));
const Courses = lazy(() => import("./pages/Courses"));
const CourseDetail = lazy(() => import("./pages/CourseDetail"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Admin = lazy(() => import("./pages/Admin"));
const AdminProjects = lazy(() => import("./pages/AdminProjects"));
const AdminCourses = lazy(() => import("./pages/AdminCourses"));
const AdminAchievements = lazy(() => import("./pages/AdminAchievements"));
const AdminProjectPreview = lazy(() => import("./pages/AdminProjectPreview"));
const AcademyHome = lazy(() => import("./pages/AcademyHome"));
const AcademyLogin = lazy(() => import("./pages/AcademyLogin"));
const AcademyDashboard = lazy(() => import("./pages/AcademyDashboard"));
const AcademyLessons = lazy(() => import("./pages/AcademyLessons"));
const AcademyLesson = lazy(() => import("./pages/AcademyLesson"));
const AcademyPractice = lazy(() => import("./pages/AcademyPractice"));
const AcademyAssignments = lazy(() => import("./pages/AcademyAssignments"));
const AcademyAssignment = lazy(() => import("./pages/AcademyAssignment"));
const AcademyProgress = lazy(() => import("./pages/AcademyProgress"));
const AcademyTeacherPlaceholder = lazy(
  () => import("./pages/AcademyTeacherPlaceholder"),
);
const AcademyPlaceholder = lazy(() => import("./pages/AcademyPlaceholder"));
const AcademyLayout = lazy(() => import("./components/academy/AcademyLayout"));
const AcademyGuard = lazy(() => import("./components/academy/AcademyGuard"));
const AcademyTeacherGuard = lazy(
  () => import("./components/academy/AcademyTeacherGuard"),
);

const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
  </div>
);

function App() {
  const { pathname, search } = useLocation();
  const isAdminRoute = pathname.startsWith("/admin");
  const isAcademyRoute = pathname.startsWith("/academy");

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname, search]);

  return (
    <HelmetProvider>
      <ThemeProvider>
        <AuthProvider>
          <AcademyAuthProvider>
            <MotionConfig reducedMotion="user">
              <div className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-300">
                <a
                  href="#main-content"
                  className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-blue-600 focus:text-white focus:text-sm focus:font-semibold"
                >
                  Skip to main content
                </a>
                <Loader>
                  {!isAdminRoute && !isAcademyRoute && <Navbar />}
                  <main id="main-content" className="flex-grow">
                    <Suspense fallback={<PageLoader />}>
                      <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/portfolio" element={<Portfolio />} />
                        <Route
                          path="/portfolio/:id"
                          element={<ProjectDetail />}
                        />
                        <Route path="/skills" element={<Skills />} />
                        <Route path="/about" element={<About />} />
                        <Route path="/blog" element={<Blog />} />
                        <Route path="/blog/:id" element={<BlogPost />} />
                        <Route path="/contact" element={<Contact />} />
                        <Route path="/courses" element={<Courses />} />
                        <Route
                          path="/courses/:slug"
                          element={<CourseDetail />}
                        />
                        <Route path="/now" element={<Now />} />
                        <Route
                          path="/engineering-experience"
                          element={<EngineeringExperience />}
                        />
                        <Route path="/resume" element={<Resume />} />
                        <Route path="/admin/login" element={<Admin />} />
                        <Route
                          path="/admin/projects"
                          element={<AdminProjects />}
                        />
                        <Route
                          path="/admin/projects/preview/:id"
                          element={<AdminProjectPreview />}
                        />
                        <Route
                          path="/admin/courses"
                          element={<AdminCourses />}
                        />
                        <Route
                          path="/admin/achievements"
                          element={<AdminAchievements />}
                        />
                        <Route path="/admin" element={<Admin />} />
                        <Route path="/academy" element={<AcademyHome />} />
                        <Route
                          path="/academy/login"
                          element={<AcademyLogin />}
                        />
                        <Route element={<AcademyGuard />}>
                          <Route element={<AcademyLayout />}>
                            <Route
                              path="/academy/dashboard"
                              element={<AcademyDashboard />}
                            />
                            <Route
                              path="/academy/lessons"
                              element={<AcademyLessons />}
                            />
                            <Route
                              path="/academy/lessons/:id"
                              element={<AcademyLesson />}
                            />
                            <Route
                              path="/academy/practice"
                              element={<AcademyPractice />}
                            />
                            <Route
                              path="/academy/assignments"
                              element={<AcademyAssignments />}
                            />
                            <Route
                              path="/academy/assignments/:id"
                              element={<AcademyAssignment />}
                            />
                            <Route
                              path="/academy/progress"
                              element={<AcademyProgress />}
                            />
                            <Route
                              path="/academy/projects"
                              element={<AcademyPlaceholder />}
                            />
                          </Route>
                        </Route>
                        <Route element={<AcademyTeacherGuard />}>
                          <Route element={<AcademyLayout />}>
                            <Route
                              path="/academy/teacher"
                              element={<AcademyTeacherPlaceholder />}
                            />
                            <Route
                              path="/academy/teacher/students"
                              element={<AcademyTeacherPlaceholder />}
                            />
                            <Route
                              path="/academy/teacher/classes"
                              element={<AcademyTeacherPlaceholder />}
                            />
                            <Route
                              path="/academy/teacher/assignments"
                              element={<AcademyTeacherPlaceholder />}
                            />
                            <Route
                              path="/academy/teacher/submissions"
                              element={<AcademyTeacherPlaceholder />}
                            />
                          </Route>
                        </Route>
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </Suspense>
                  </main>
                  {!isAdminRoute && !isAcademyRoute && <Footer />}
                </Loader>
                {!isAdminRoute && !isAcademyRoute && <PWAInstallPrompt />}
              </div>
            </MotionConfig>
          </AcademyAuthProvider>
        </AuthProvider>
      </ThemeProvider>
    </HelmetProvider>
  );
}

export default App;
