import { useLocation } from "react-router-dom";
import AcademyLayout from "./AcademyLayout";
import StudentSectionNav from "./StudentSectionNav";

const SECTION_ROUTES = new Set([
  "/academy/lessons",
  "/academy/materials",
  "/academy/courses",
  "/academy/assignments",
  "/academy/projects",
  "/academy/progress",
  "/academy/leaderboard",
  "/academy/achievements",
]);

export default function AcademyStudentLayout() {
  const { pathname } = useLocation();
  const showSectionNav = SECTION_ROUTES.has(pathname);

  return (
    <AcademyLayout
      workspace="student"
      aboveOutlet={showSectionNav ? <StudentSectionNav /> : null}
    />
  );
}
