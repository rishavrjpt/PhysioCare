import { useNavigate, useLocation } from "react-router-dom";
import { decodeToken } from "../utils/auth";
import { useState, useEffect } from "react";
import UserProfileModal from "./UserProfileModal";
import "../style/sidebar.css";
import { API_BASE_URL } from "../config";
import { cachedFetch } from "../utils/dataStore";

function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [userName, setUserName] = useState("User Profile");
  const [userPhoto, setUserPhoto] = useState("");
  const [userCity, setUserCity] = useState("");

  useEffect(() => {
    const fetchUser = async () => {
      const token = localStorage.getItem("patientToken");
      if (!token) return;
      try {
        const payload = decodeToken(token);
        const data = await cachedFetch(`user:${payload.id}`, `${API_BASE_URL}/auth/${payload.id}`, { ttl: 30000 });
        if (data && data.name) {
          setUserName(data.name);
          setUserPhoto(data.profilePhoto || "");
          setUserCity(data.city || "");
        }
      } catch (error) {
        console.error("Error fetching username:", error);
      }
    };
    fetchUser();

    const handleUpdate = () => {
      fetchUser();
    };
    window.addEventListener("physiocare:profile-updated", handleUpdate);
    return () => window.removeEventListener("physiocare:profile-updated", handleUpdate);
  }, []);

  return (
    <div className="sidebar patient-sidebar">
      {/* LOGO */}
      <div className="logo-container">
        <svg className="logo-icon" width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="32" height="32" rx="8" fill="var(--primary-500)" />
          <path d="M16 8V24M8 16H24" stroke="white" strokeWidth="4" strokeLinecap="round" />
        </svg>
        <h2 className="logo">PhysioCare</h2>
      </div>

      {/* MENU */}
      <ul className="nav-menu">
        <li
          className={location.pathname === "/dashboard" ? "active" : ""}
          onClick={() => navigate('/dashboard')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          <span>Home</span>
        </li>
        <li
          className={location.pathname === "/appointments" ? "active" : ""}
          onClick={() => navigate('/appointments')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          <span>Appointments</span>
        </li>
        <li
          className={location.pathname === "/reports" ? "active" : ""}
          onClick={() => navigate('/reports')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
          <span>My Reports</span>
        </li>
        <li
          className={location.pathname === "/videos" ? "active" : ""}
          onClick={() => navigate('/videos')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
          <span>Videos</span>
        </li>
        <li
          className={location.pathname === "/articles" ? "active" : ""}
          onClick={() => navigate('/articles')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
          <span>Articles</span>
        </li>
        <li
          className={location.pathname === "/our-team" ? "active" : ""}
          onClick={() => navigate('/our-team')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          <span>Our Team</span>
        </li>
      </ul>

      {/* USER */}
      <div className="sidebar-bottom" onClick={() => setIsProfileOpen(true)} style={{ cursor: 'pointer', padding: '16px 24px', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {userPhoto ? (
            <img src={userPhoto} alt={userName} style={{ width: "36px", height: "36px", borderRadius: "50%", objectFit: "cover" }} />
          ) : (
            <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "var(--gradient-brand)", display: "flex", alignItems: "center", justifyContent: "center", color: "#ffffff", fontWeight: "700", fontSize: "14px", flexShrink: 0 }}>
              {userName.charAt(0)}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
            <span style={{ color: "var(--text-primary)", fontSize: "14px", fontWeight: "600", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{userName}</span>
            <span style={{ color: "var(--text-muted)", fontSize: "12px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{userCity || "Patient"}</span>
          </div>
        </div>
      </div>

      <UserProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} role="patient" />
    </div>
  );
}

export default Sidebar;