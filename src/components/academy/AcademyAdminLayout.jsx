import { useLocation } from "react-router-dom";
import AcademyLayout from "./AcademyLayout";
import AdminContentNav from "./AdminContentNav";

const CONTENT_ROUTES = new Set([
  "/academy/admin/content",
  "/academy/admin/courses",
  "/academy/admin/lessons",
  "/academy/admin/practice",
  "/academy/admin/assignments",
  "/academy/admin/question-bank",
  "/academy/admin/exams",
  "/academy/admin/exam-results",
  "/academy/admin/projects",
  "/academy/admin/materials",
  "/academy/admin/levels",
]);

export default function AcademyAdminLayout() {
  const { pathname } = useLocation();
  const showContentNav = CONTENT_ROUTES.has(pathname);

  return (
    <AcademyLayout
      workspace="admin"
      aboveOutlet={showContentNav ? <AdminContentNav /> : null}
    />
  );
}
