import { useNavigate, useLocation } from "react-router-dom";
import { decodeToken } from "../utils/auth";
import { useState, useEffect } from "react";
import UserProfileModal from "./UserProfileModal";
import { API_BASE_URL } from "../config";
import { cachedFetch, emitProfileUpdated } from "../utils/dataStore";

function DoctorSidebar() {
    const navigate = useNavigate();
    const location = useLocation();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [doctorName, setDoctorName] = useState("Doctor");
    const [doctorPhoto, setDoctorPhoto] = useState("");
    const [doctorSpecialization, setDoctorSpecialization] = useState("Physiotherapist");
    const [isAvailable, setIsAvailable] = useState(false);
    const [togglingAvailability, setTogglingAvailability] = useState(false);

    const fetchDoctorData = async () => {
        const token = localStorage.getItem("doctorToken");
        if (!token) return;
        try {
            const payload = decodeToken(token);

            // Fetch user info and doctor profile in parallel
            const [userData, profileData] = await Promise.all([
                cachedFetch(`user:${payload.id}`, `${API_BASE_URL}/auth/${payload.id}`, { ttl: 30000 }),
                cachedFetch(`doctor:${payload.id}`, `${API_BASE_URL}/doctors/${payload.id}`, { ttl: 30000 })
            ]);

            if (userData && userData.name) {
                setDoctorName(userData.name);
                setDoctorPhoto(userData.profilePhoto || "");
            }
            if (profileData) {
                if (profileData.isAvailable !== undefined) {
                    setIsAvailable(profileData.isAvailable);
                }
                if (profileData.specialization) {
                    setDoctorSpecialization(profileData.specialization);
                }
            }
        } catch (error) {
            console.error("Error fetching doctor data:", error);
        }
    };

    useEffect(() => {
        fetchDoctorData();

        const handleUpdate = () => {
            fetchDoctorData();
        };
        window.addEventListener("physiocare:profile-updated", handleUpdate);
        return () => window.removeEventListener("physiocare:profile-updated", handleUpdate);
    }, []);

    const handleToggleAvailability = async () => {
        const token = localStorage.getItem("doctorToken");
        if (!token || togglingAvailability) return;

        const payload = decodeToken(token);
        const previous = isAvailable;
        const nextVal = !previous;

        // Optimistic UI update
        setIsAvailable(nextVal);
        setTogglingAvailability(true);

        try {
            const response = await fetch(`${API_BASE_URL}/doctors/${payload.id}/availability`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" }
            });
            if (response.ok) {
                const data = await response.json();
                setIsAvailable(data.isAvailable);
                emitProfileUpdated(payload.id);
            } else {
                setIsAvailable(previous);
                alert("Failed to update availability. Please try again.");
            }
        } catch (error) {
            console.error("Error toggling availability:", error);
            setIsAvailable(previous);
            alert("Network error toggling availability.");
        } finally {
            setTogglingAvailability(false);
        }
    };

    const isActive = (path) => location.pathname === path;

    return (
        <>
            <div className="sidebar">
                {/* LOGO */}
                <div className="logo-container">
                    <svg className="logo-icon" width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect width="32" height="32" rx="8" fill="var(--primary-500)" />
                        <path d="M16 8V24M8 16H24" stroke="white" strokeWidth="4" strokeLinecap="round" />
                    </svg>
                    <h2 className="logo">PhysioCare</h2>
                </div>

                {/* NAV MENU */}
                <ul className="nav-menu">
                    <li className={isActive('/doctor/dashboard') ? 'active' : ''} onClick={() => navigate('/doctor/dashboard')}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                        <span>Dashboard</span>
                    </li>
                    <li className={isActive('/doctor/appointments') ? 'active' : ''} onClick={() => navigate('/doctor/appointments')}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                        <span>Appointments</span>
                    </li>
                    <li className={isActive('/doctor/articles') || location.pathname.startsWith('/doctor/articles') ? 'active' : ''} onClick={() => navigate('/doctor/articles')}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                        <span>Articles</span>
                    </li>
                    <li className={isActive('/doctor/programs') ? 'active' : ''} onClick={() => navigate('/doctor/programs')}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        <span>Programs</span>
                    </li>
                    <li className={isActive('/doctor/reports') ? 'active' : ''} onClick={() => navigate('/doctor/reports')}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>
                        <span>Reports</span>
                    </li>
                    <li className={isActive('/doctor/our-team') ? 'active' : ''} onClick={() => navigate('/doctor/our-team')}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                        <span>Our Team</span>
                    </li>
                </ul>



                {/* PROFILE AT BOTTOM */}
                <div
                    className="sidebar-bottom"
                    onClick={() => setIsProfileOpen(true)}
                    style={{ cursor: 'pointer', padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '12px' }}
                >
                    {doctorPhoto ? (
                        <img src={doctorPhoto} alt={doctorName} style={{ width: "36px", height: "36px", borderRadius: "50%", objectFit: "cover" }} />
                    ) : (
                        <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "var(--gradient-brand)", display: "flex", alignItems: "center", justifyContent: "center", color: "#ffffff", fontWeight: "700", fontSize: "14px", flexShrink: 0 }}>
                            {doctorName.charAt(0)}
                        </div>
                    )}
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
                        <span style={{ color: "var(--text-primary)", fontSize: "14px", fontWeight: "600", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{doctorName}</span>
                        <span style={{ color: "var(--text-muted)", fontSize: "12px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{doctorSpecialization}</span>
                    </div>
                </div>
            </div>

            <UserProfileModal 
                isOpen={isProfileOpen} 
                onClose={() => setIsProfileOpen(false)} 
                role="doctor" 
                isAvailable={isAvailable}
                handleToggleAvailability={handleToggleAvailability}
                togglingAvailability={togglingAvailability}
            />
        </>
    );
}

export default DoctorSidebar;
