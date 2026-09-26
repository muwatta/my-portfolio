import { Navigate, Outlet } from "react-router-dom";
import { useAcademyAuth } from "../../hooks/useAcademyAuth";
import AcademyLoadingScreen from "./AcademyLoadingScreen";

export default function AcademyTeacherGuard() {
  const { initializing, isTeacher, isAdmin } = useAcademyAuth();
  if (initializing)
    return (
      <AcademyLoadingScreen
        title="Checking teaching access"
        subtitle="Loading your classes and learners"
      />
    );
  if (!isTeacher && !isAdmin)
    return <Navigate to="/academy/dashboard" replace />;
  return <Outlet />;
}
