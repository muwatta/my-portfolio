import { Navigate, Outlet } from "react-router-dom";
import { useAcademyAuth } from "../../hooks/useAcademyAuth";
import AcademyLoadingScreen from "./AcademyLoadingScreen";

export default function AcademyAdminGuard() {
  const { initializing, isAdmin } = useAcademyAuth();
  if (initializing) {
    return (
      <AcademyLoadingScreen
        title="Checking administrator access"
        subtitle="Verifying your Academy permissions"
      />
    );
  }
  if (!isAdmin) return <Navigate to="/academy/dashboard" replace />;
  return <Outlet />;
}
