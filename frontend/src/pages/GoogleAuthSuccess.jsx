import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

/**
 * GoogleAuthSuccess
 * ─────────────────
 * Backend redirects here after Google OAuth with:
 *   #token=JWT&role=patient|doctor&profileCompleted=true|false
 *
 * The token is in the URL fragment (#), which is never sent to servers or logged.
 * (Old ?token=... links are still accepted.) This page stores the token and redirects.
 */
const readAuthParams = () => {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const query = new URLSearchParams(window.location.search);
  const get = (key) => hash.get(key) ?? query.get(key);
  return { token: get("token"), role: get("role"), profileCompleted: get("profileCompleted") === "true" };
};

function GoogleAuthSuccess() {
  const navigate = useNavigate();
  // Read once, on first render — no setState inside the effect needed.
  const [auth] = useState(readAuthParams);
  const statusMsg = auth.token && auth.role ? "Completing sign in…" : "Login failed. Redirecting…";

  useEffect(() => {
    // Remove the token from the address bar / browser history.
    window.history.replaceState(null, "", window.location.pathname);

    const { token, role, profileCompleted } = auth;
    let timer;
    if (!token || !role) {
      timer = setTimeout(() => navigate("/"), 2000);
    } else if (role === "doctor" || role === "admin") {
      localStorage.setItem("doctorToken", token);
      timer = setTimeout(() => navigate(profileCompleted ? "/doctor/dashboard" : "/doctor/onboarding"), 800);
    } else {
      localStorage.setItem("patientToken", token);
      timer = setTimeout(() => navigate(profileCompleted ? "/dashboard" : "/patient/onboarding"), 800);
    }
    return () => clearTimeout(timer);
  }, [auth, navigate]);

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        {/* Spinner */}
        <div style={styles.spinnerWrap}>
          <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
            <circle cx="24" cy="24" r="20" stroke="#e2e8f0" strokeWidth="4" />
            <path
              d="M24 4a20 20 0 0 1 20 20"
              stroke="var(--primary-500)"
              strokeWidth="4"
              strokeLinecap="round"
            >
              <animateTransform
                attributeName="transform"
                type="rotate"
                from="0 24 24"
                to="360 24 24"
                dur="0.8s"
                repeatCount="indefinite"
              />
            </path>
          </svg>
        </div>

        {/* Google logo */}
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style={{ marginBottom: "12px" }}>
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
        </svg>

        <h2 style={styles.title}>Signing you in…</h2>
        <p style={styles.subtitle}>{statusMsg}</p>
      </div>
    </div>
  );
}

/**
 * GoogleAuthError — shown when OAuth fails (wrong role, etc.)
 */
export function GoogleAuthError() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const msg = searchParams.get("msg") || "Google login failed.";
  const role = searchParams.get("role"); // the actual role of the account

  const redirect = role === "doctor" || role === "admin" ? "/physiotherapist" : "/patient";
  const portalLabel = role === "doctor" || role === "admin" ? "Physiotherapist Login" : "Patient Login";

  return (
    <div style={styles.wrapper}>
      <div style={{ ...styles.card, borderTop: "4px solid #ef4444" }}>
        <div style={{ fontSize: "40px", marginBottom: "12px" }}>⚠️</div>
        <h2 style={{ ...styles.title, color: "#dc2626" }}>Login Failed</h2>
        <p style={{ ...styles.subtitle, color: "#64748b", marginBottom: "24px" }}>{msg}</p>

        {role && (
          <button
            onClick={() => navigate(redirect)}
            style={styles.btn}
          >
            Go to {portalLabel}
          </button>
        )}
        <button
          onClick={() => navigate("/")}
          style={{ ...styles.btn, background: "transparent", color: "var(--primary)", border: "1.5px solid var(--primary-500)", marginTop: "10px" }}
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, var(--primary-50) 0%, #f0fdf4 100%)",
    fontFamily: "'Inter', sans-serif",
  },
  card: {
    background: "#fff",
    borderRadius: "20px",
    padding: "48px 40px",
    boxShadow: "0 20px 60px rgba(0,0,0,0.10)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    maxWidth: "380px",
    width: "90%",
    textAlign: "center",
  },
  spinnerWrap: {
    marginBottom: "24px",
  },
  title: {
    fontSize: "22px",
    fontWeight: "700",
    color: "#1e293b",
    margin: "0 0 8px",
  },
  subtitle: {
    fontSize: "14px",
    color: "#94a3b8",
    margin: 0,
  },
  btn: {
    width: "100%",
    padding: "12px",
    background: "var(--primary-500)",
    color: "#fff",
    border: "none",
    borderRadius: "10px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    fontFamily: "'Inter', sans-serif",
  },
};

export default GoogleAuthSuccess;
