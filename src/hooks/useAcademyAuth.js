import { useContext } from "react";
import { AcademyAuthContext } from "../context/AcademyAuthContextValue";

export function useAcademyAuth() {
  return useContext(AcademyAuthContext);
}
