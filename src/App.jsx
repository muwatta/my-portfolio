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
const CourseDetail = lazy(() => import("./pages/CourseDetail"));
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
const NotFound = lazy(() => import("./pages/NotFound"));
const Admin = lazy(() => import("./pages/Admin"));
const AdminProjects = lazy(() => import("./pages/AdminProjects"));
const AdminCourses = lazy(() => import("./pages/AdminCourses"));
const AdminAchievements = lazy(() => import("./pages/AdminAchievements"));
const AdminProjectPreview = lazy(() => import("./pages/AdminProjectPreview"));
const AcademyHome = lazy(() => import("./pages/AcademyHome"));
const AcademyLogin = lazy(() => import("./pages/AcademyLogin"));
const AcademySignup = lazy(() => import("./pages/AcademySignup"));
const AcademyResetPassword = lazy(() => import("./pages/AcademyResetPassword"));
const AcademyForgotPassword = lazy(
  () => import("./pages/AcademyForgotPassword"),
);
const AcademyDashboard = lazy(() => import("./pages/AcademyDashboard"));
const AcademyCourses = lazy(() => import("./pages/AcademyCourses"));
const AcademyLessons = lazy(() => import("./pages/AcademyLessons"));
const AcademyLesson = lazy(() => import("./pages/AcademyLesson"));
const AcademyPractice = lazy(() => import("./pages/AcademyPractice"));
const AcademyAssignments = lazy(() => import("./pages/AcademyAssignments"));
const AcademyAssignment = lazy(() => import("./pages/AcademyAssignment"));
const AcademyProgress = lazy(() => import("./pages/AcademyProgress"));
const AcademyProjects = lazy(() => import("./pages/AcademyProjects"));
const AcademyLeaderboard = lazy(() => import("./pages/AcademyLeaderboard"));
const AcademyNotifications = lazy(() => import("./pages/AcademyNotifications"));
const AcademyLiveRoom = lazy(() => import("./pages/AcademyLiveRoom"));
const AcademyTeacherAnalytics = lazy(
  () => import("./pages/AcademyTeacherAnalytics"),
);
const AcademyTeacherPlaceholder = lazy(
  () => import("./pages/AcademyTeacherPlaceholder"),
);
const AcademyTeacherStudents = lazy(
  () => import("./pages/AcademyTeacherStudents"),
);
const AcademyTeacherCourses = lazy(
  () => import("./pages/AcademyTeacherCourses"),
);
const AcademyTeacherLessons = lazy(
  () => import("./pages/AcademyTeacherLessons"),
);
const AcademyTeacherSubmissions = lazy(
  () => import("./pages/AcademyTeacherSubmissions"),
);
const AcademyTeacherAssignments = lazy(
  () => import("./pages/AcademyTeacherAssignments"),
);
const AcademyTeacherClasses = lazy(
  () => import("./pages/AcademyTeacherClasses"),
);
const AcademyStudentLayout = lazy(
  () => import("./components/academy/AcademyStudentLayout"),
);
const AcademyAdminLayout = lazy(
  () => import("./components/academy/AcademyAdminLayout"),
);
const AcademyTeacherLayout = lazy(
  () => import("./components/academy/AcademyTeacherLayout"),
);
const AcademyGuard = lazy(() => import("./components/academy/AcademyGuard"));
const AcademyStudentGuard = lazy(
  () => import("./components/academy/AcademyStudentGuard"),
);
const AcademyTeacherGuard = lazy(
  () => import("./components/academy/AcademyTeacherGuard"),
);
const AcademyAdminGuard = lazy(
  () => import("./components/academy/AcademyAdminGuard"),
);
const AcademyAdminDashboard = lazy(
  () => import("./pages/AcademyAdminDashboard"),
);
const AcademyAdminStudents = lazy(() => import("./pages/AcademyAdminStudents"));
const AcademyAdminStudentProfile = lazy(
  () => import("./pages/AcademyAdminStudentProfile"),
);
const AcademyAdminLevels = lazy(() => import("./pages/AcademyAdminLevels"));
const AcademyAdminPractice = lazy(() => import("./pages/AcademyAdminPractice"));
const AcademyAdminProjects = lazy(() => import("./pages/AcademyAdminProjects"));
const AcademyAdminMaterials = lazy(() => import("./pages/AcademyAdminMaterials"));
const AcademyMaterials = lazy(() => import("./pages/AcademyMaterials"));
const AcademyAdminAccess = lazy(() => import("./pages/AcademyAdminAccess"));
const AcademyProfile = lazy(() => import("./pages/AcademyProfile"));

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
                        <Route path="/courses" element={<Portfolio />} />
                        <Route
                          path="/courses/:slug"
                          element={<CourseDetail />}
                        />
                        <Route path="/skills" element={<Skills />} />
                        <Route path="/about" element={<About />} />
                        <Route path="/blog" element={<Blog />} />
                        <Route path="/blog/:id" element={<BlogPost />} />
                        <Route path="/contact" element={<Contact />} />
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
                        <Route
                          path="/academy/signup"
                          element={<AcademySignup />}
                        />
                        <Route
                          path="/academy/reset-password"
                          element={<AcademyResetPassword />}
                        />
                        <Route
                          path="/academy/forgot-password"
                          element={<AcademyForgotPassword />}
                        />
                        <Route element={<AcademyGuard />}>
                          <Route element={<AcademyStudentGuard />}>
                            <Route element={<AcademyStudentLayout />}>
                            <Route
                              path="/academy/dashboard"
                              element={<AcademyDashboard />}
                            />
                            <Route
                              path="/academy/courses"
                              element={<AcademyCourses />}
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
                              element={<AcademyProjects />}
                            />
                            <Route
                              path="/academy/leaderboard"
                              element={<AcademyLeaderboard />}
                            />
                            <Route
                              path="/academy/notifications"
                              element={<AcademyNotifications />}
                            />
                            <Route
                              path="/academy/live"
                              element={<AcademyLiveRoom />}
                            />
                            <Route
                              path="/academy/profile"
                              element={<AcademyProfile />}
                            />
                            <Route
                              path="/academy/achievements"
                              element={<AcademyLeaderboard />}
                            />
                            <Route
                              path="/academy/materials"
                              element={<AcademyMaterials />}
                            />
                            </Route>
                          </Route>
                        </Route>
                        <Route element={<AcademyTeacherGuard />}>
                          <Route element={<AcademyTeacherLayout />}>
                            <Route
                              path="/academy/teacher"
                              element={<AcademyTeacherPlaceholder />}
                            />
                            <Route
                              path="/academy/teacher/students"
                              element={<AcademyTeacherStudents />}
                            />
                            <Route
                              path="/academy/teacher/courses"
                              element={<AcademyTeacherCourses />}
                            />
                            <Route
                              path="/academy/teacher/lessons"
                              element={<AcademyTeacherLessons />}
                            />
                            <Route
                              path="/academy/teacher/analytics"
                              element={<AcademyTeacherAnalytics />}
                            />
                            <Route
                              path="/academy/teacher/classes"
                              element={<AcademyTeacherClasses />}
                            />
                            <Route
                              path="/academy/teacher/assignments"
                              element={<AcademyTeacherAssignments />}
                            />
                            <Route
                              path="/academy/teacher/submissions"
                              element={<AcademyTeacherSubmissions />}
                            />
                          </Route>
                        </Route>
                        <Route element={<AcademyAdminGuard />}>
                          <Route element={<AcademyAdminLayout />}>
                            <Route
                              path="/academy/admin"
                              element={<AcademyAdminDashboard />}
                            />
                            <Route
                              path="/academy/admin/dashboard"
                              element={<AcademyAdminDashboard />}
                            />
                            <Route
                              path="/academy/admin/students"
                              element={<AcademyAdminStudents />}
                            />
                            <Route
                              path="/academy/admin/students/:studentId"
                              element={<AcademyAdminStudentProfile />}
                            />
                            <Route
                              path="/academy/admin/access"
                              element={<AcademyAdminAccess />}
                            />
                            <Route
                              path="/academy/admin/levels"
                              element={<AcademyAdminLevels />}
                            />
                            <Route
                              path="/academy/admin/courses"
                              element={<AcademyTeacherCourses />}
                            />
                            <Route
                              path="/academy/admin/courses/:courseId"
                              element={<AcademyTeacherCourses />}
                            />
                            <Route
                              path="/academy/admin/lessons"
                              element={<AcademyTeacherLessons />}
                            />
                            <Route
                              path="/academy/admin/lessons/:lessonId"
                              element={<AcademyTeacherLessons />}
                            />
                            <Route
                              path="/academy/admin/practice"
                              element={<AcademyAdminPractice />}
                            />
                            <Route
                              path="/academy/admin/assignments"
                              element={<AcademyTeacherAssignments />}
                            />
                            <Route
                              path="/academy/admin/assignments/:assignmentId"
                              element={<AcademyTeacherAssignments />}
                            />
                            <Route
                              path="/academy/admin/projects"
                              element={<AcademyAdminProjects />}
                            />
                            <Route
                              path="/academy/admin/schedule"
                              element={<AcademyTeacherClasses />}
                            />
                            <Route
                              path="/academy/admin/submissions"
                              element={<AcademyTeacherSubmissions />}
                            />
                            <Route
                              path="/academy/admin/submissions/:submissionId"
                              element={<AcademyTeacherSubmissions />}
                            />
                            <Route
                              path="/academy/admin/materials"
                              element={<AcademyAdminMaterials />}
                            />
                            <Route
                              path="/academy/admin/live"
                              element={<AcademyLiveRoom />}
                            />
                            <Route
                              path="/academy/admin/leaderboard"
                              element={<AcademyLeaderboard />}
                            />
                            <Route
                              path="/academy/admin/analytics"
                              element={<AcademyTeacherAnalytics />}
                            />
                            <Route
                              path="/academy/admin/settings"
                              element={<AcademyAdminAccess />}
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
