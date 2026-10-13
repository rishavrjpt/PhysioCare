import { Navigate, useLocation } from "react-router-dom";
import { getValidPayload, PATIENT_TOKEN, DOCTOR_TOKEN } from "../utils/auth";

/**
 * Protects dashboard pages. Without a valid (non-expired) login the user is
 * sent to the right login page instead of seeing an empty, broken dashboard.
 *   <RequireAuth role="patient"> ... </RequireAuth>
 *   <RequireAuth role="doctor">  ... </RequireAuth>
 *   <RequireAuth role="any">     ... </RequireAuth>   (either login works)
 */
export default function RequireAuth({ role, children }) {
  const location = useLocation();
  const patient = role !== "doctor" ? getValidPayload(PATIENT_TOKEN) : null;
  const doctor = role !== "patient" ? getValidPayload(DOCTOR_TOKEN) : null;

  if (patient || doctor) return children;

  const loginPath = role === "doctor" ? "/doctor/login" : "/patient";
  return <Navigate to={loginPath} replace state={{ from: location.pathname }} />;
}
