import { API_BASE_URL } from "../config";

export const PATIENT_TOKEN = "patientToken";
export const DOCTOR_TOKEN = "doctorToken";

// JWTs use base64url ("-" and "_"), which plain atob() rejects, so convert first.
// Throws on a malformed token, just like the old JSON.parse(atob(...)) did.
export const decodeToken = (token) => {
  const part = String(token).split(".")[1];
  if (!part) throw new Error("Invalid token");
  const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  return JSON.parse(atob(padded));
};

// Returns the decoded payload if the token exists and has not expired, otherwise null.
export const getValidPayload = (tokenKey) => {
  const token = localStorage.getItem(tokenKey);
  if (!token) return null;
  try {
    const payload = decodeToken(token);
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      localStorage.removeItem(tokenKey);
      return null;
    }
    return payload;
  } catch {
    localStorage.removeItem(tokenKey);
    return null;
  }
};

const isDoctorPath = (pathname) =>
  pathname.startsWith("/doctor") || pathname.startsWith("/physiotherapist");

// Which stored token belongs to the page the user is on.
const tokenKeyForCurrentPage = () => {
  const path = window.location.pathname;
  if (isDoctorPath(path)) return DOCTOR_TOKEN;
  // Shared pages (/article, /video) — use whichever login exists, patient first.
  if (["/article", "/video"].includes(path) && !localStorage.getItem(PATIENT_TOKEN)) return DOCTOR_TOKEN;
  return PATIENT_TOKEN;
};

// Auth endpoints return 401 for normal reasons (e.g. "email not verified"), so never auto-logout on those.
const PUBLIC_AUTH_PATHS = ["/auth/login", "/auth/signup", "/auth/verify-otp", "/auth/resend-otp",
  "/auth/forgot-password", "/auth/reset-password", "/auth/verify-email"];

let activeSlowRequests = 0;
let toastEl = null;

function showWakeupToast() {
  if (typeof document === "undefined") return;
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.id = "wakeup-server-toast";
    toastEl.textContent = "Waking up the server, this can take up to a minute the first time…";
    toastEl.setAttribute("role", "status");
    toastEl.setAttribute("aria-live", "polite");
    Object.assign(toastEl.style, {
      position: "fixed",
      bottom: "24px",
      left: "50%",
      transform: "translateX(-50%)",
      backgroundColor: "var(--primary-dark, #0F766E)",
      color: "#FFFFFF",
      padding: "10px 22px",
      borderRadius: "9999px",
      fontSize: "13px",
      fontWeight: "500",
      boxShadow: "0 8px 24px rgba(15, 118, 110, 0.25)",
      zIndex: "999999",
      pointerEvents: "none",
      transition: "opacity 0.25s ease, transform 0.25s ease",
      opacity: "0"
    });
    document.body.appendChild(toastEl);
    requestAnimationFrame(() => {
      if (toastEl) toastEl.style.opacity = "1";
    });
  }
}

function hideWakeupToast() {
  if (toastEl && activeSlowRequests <= 0) {
    toastEl.style.opacity = "0";
    setTimeout(() => {
      if (activeSlowRequests <= 0 && toastEl && toastEl.parentNode) {
        toastEl.parentNode.removeChild(toastEl);
        toastEl = null;
      }
    }, 250);
  }
}

/**
 * Adds "Authorization: Bearer <token>" to every request sent to our API,
 * so the backend can check who is calling. Pages keep using plain fetch().
 * If the backend says the session expired (401), the user is sent back to login.
 */
export const installAuthFetch = () => {
  if (window.__authFetchInstalled) return;
  window.__authFetchInstalled = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input, init = {}) => {
    const url = typeof input === "string" ? input : input?.url || "";
    if (!url.startsWith(API_BASE_URL)) return originalFetch(input, init);

    const tokenKey = tokenKeyForCurrentPage();
    const token = localStorage.getItem(tokenKey);
    const headers = new Headers(init.headers || (typeof input !== "string" ? input.headers : undefined));
    if (token && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${token}`);

    let slowTimerFired = false;
    const slowTimer = setTimeout(() => {
      slowTimerFired = true;
      activeSlowRequests++;
      showWakeupToast();
    }, 4000);

    try {
      const response = await originalFetch(input, { ...init, headers });

      const isPublicAuth = PUBLIC_AUTH_PATHS.some((p) => url.startsWith(API_BASE_URL + p));
      if (response.status === 401 && token && !isPublicAuth) {
        localStorage.removeItem(tokenKey);
        const loginPath = tokenKey === DOCTOR_TOKEN ? "/doctor/login" : "/patient";
        if (window.location.pathname !== loginPath) {
          window.location.assign(`${loginPath}?expired=1`);
        }
      }
      return response;
    } finally {
      clearTimeout(slowTimer);
      if (slowTimerFired) {
        activeSlowRequests = Math.max(0, activeSlowRequests - 1);
        hideWakeupToast();
      }
    }
  };
};
