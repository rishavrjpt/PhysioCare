import { useEffect, useState, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../config";

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  // Decide the starting state from the token directly (no setState inside the effect)
  const [status, setStatus] = useState(token ? "verifying" : "error"); // verifying | success | error
  const [message, setMessage] = useState(token ? "Verifying your email..." : "Invalid verification link.");
  const navigate = useNavigate();
  const hasFetched = useRef(false);

  useEffect(() => {
    if (!token || hasFetched.current) return;
    hasFetched.current = true;

    const verify = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/auth/verify-email/${token}`);
        const data = await response.json();

        if (response.ok) {
          setStatus("success");
          setMessage(data.msg || "Email verified successfully!");
          setTimeout(() => navigate("/patient"), 3000); // there is no /login route
        } else {
          setStatus("error");
          setMessage(data.msg || "Verification failed.");
        }
      } catch {
        setStatus("error");
        setMessage("Connection error. Please try again later.");
      }
    };

    verify();
  }, [token, navigate]);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--primary-50)",
      padding: "20px"
    }}>
      <div style={{
        background: "white",
        padding: "40px",
        borderRadius: "16px",
        boxShadow: "0 10px 25px rgba(0,0,0,0.05)",
        textAlign: "center",
        maxWidth: "400px",
        width: "100%"
      }}>
        <div style={{ marginBottom: "20px" }}>
          {status === "verifying" && (
            <div style={{ width: "40px", height: "40px", border: "4px solid var(--primary-100)", borderTop: "4px solid var(--primary)", borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto" }}></div>
          )}
          {status === "success" && (
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          )}
          {status === "error" && (
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>
          )}
        </div>
        
        <h2 style={{ color: "var(--primary-900)", marginBottom: "10px" }}>Email Verification</h2>
        <p style={{ color: "#64748b", margin: 0 }}>{message}</p>
        
        {status === "success" && (
          <p style={{ fontSize: "12px", color: "#94a3b8", marginTop: "20px" }}>Redirecting to login...</p>
        )}
        
        {status === "error" && (
          <button 
            onClick={() => navigate("/patient")}
            style={{ marginTop: "24px", background: "var(--primary)", color: "white", border: "none", padding: "10px 20px", borderRadius: "8px", fontWeight: "600", cursor: "pointer" }}
          >
            Back to Login
          </button>
        )}
      </div>
      
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default VerifyEmail;
