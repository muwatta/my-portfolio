import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAcademyAuth } from "../../hooks/useAcademyAuth";
import AcademyLoadingScreen from "./AcademyLoadingScreen";

export default function AcademyGuard() {
  const { user, initializing } = useAcademyAuth();
  const location = useLocation();

  if (initializing)
    return (
      <AcademyLoadingScreen
        title="Loading Academy"
        subtitle="Restoring your session"
      />
    );
  if (!user)
    return (
      <Navigate
        to="/academy/login"
        replace
        state={{ from: location.pathname }}
      />
    );

  return <Outlet />;
}
