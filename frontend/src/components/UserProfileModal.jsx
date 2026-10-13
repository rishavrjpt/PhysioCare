import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { decodeToken } from "../utils/auth";
import "./UserProfileModal.css";
import { API_BASE_URL } from "../config";
import { cachedFetch, emitProfileUpdated } from "../utils/dataStore";
import { resizeImage } from "../utils/imageUtils";

const PRIVACY_CONTENT = [
    { heading: "1. Information We Collect", body: "We collect information you provide directly, including your name, email address, phone number, date of birth, medical history, and notes you share with your physiotherapist. We do not store sensitive payment credentials on our servers." },
    { heading: "2. How We Use Your Information", body: "Your information is used solely to facilitate physiotherapy care, manage appointments, deliver personalised exercise programs, track recovery progress, and maintain communication between you and your healthcare provider." },
    { heading: "3. Information Sharing", body: "We do not sell, rent, or trade your personal or health data. Your health records and exercise logs are shared only with your assigned physiotherapist. We may disclose data if required by law or to protect user safety." },
    { heading: "4. Data Security", body: "We use industry-standard encryption (HTTPS / TLS) in transit and secure database storage. Access to patient records is strictly restricted to authorized healthcare practitioners assigned to your care." },
    { heading: "5. Your Rights", body: "You have the right to access, correct, or request deletion of your personal data at any time. To make a request, contact our privacy team at privacy@physiocare.in." },
    { heading: "6. Changes to this Policy", body: "We may update this policy periodically to reflect changes in our practices or applicable healthcare privacy regulations. Continued use of PhysioCare constitutes acceptance of the updated policy." },
    { heading: "7. Contact Us", body: "If you have questions about this Privacy Policy: privacy@physiocare.in" },
];

const TERMS_CONTENT = [
    { heading: "1. Acceptance of Terms", body: "By registering and using PhysioCare, you agree to these Terms of Service. If you do not agree, please do not use the platform. These terms apply to both patients and physiotherapists." },
    { heading: "2. Platform Use", body: "PhysioCare is a healthcare coordination platform that connects patients with licensed physiotherapists. It is not a substitute for emergency medical care. For any medical emergency, please contact local emergency services immediately." },
    { heading: "3. Patient Responsibilities", body: "Patients are responsible for providing accurate health information, attending scheduled appointments, following prescribed exercise programs, and providing honest feedback on sessions. Misuse of the platform or abuse of healthcare providers will result in account suspension." },
    { heading: "4. Physiotherapist Responsibilities", body: "Physiotherapists must hold valid professional licences in their jurisdiction, provide accurate credentials during onboarding, maintain patient confidentiality, and deliver care that meets professional standards. PhysioCare reserves the right to remove practitioners who violate these obligations." },
    { heading: "5. Appointments & Cancellations", body: "Appointments may be cancelled or rescheduled by either party with reasonable notice. Repeated no-shows may affect your ability to book future appointments. Physiotherapists set their own availability and consultation fees." },
    { heading: "6. Intellectual Property", body: "All exercise videos, articles, program content, and platform design are the property of PhysioCare or its licensed contributors. You may not reproduce, distribute, or sell any platform content without written permission." },
    { heading: "7. Limitation of Liability", body: "PhysioCare is a coordination platform and is not liable for the clinical outcomes of treatment. All medical decisions are made by licensed healthcare professionals. We are not responsible for harm resulting from exercises performed incorrectly or without supervision." },
    { heading: "8. Governing Law", body: "These terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of courts in Rajasthan, India." },
    { heading: "9. Contact", body: "For terms-related queries: legal@physiocare.in" },
];

function PolicyView({ type, onBack }) {
    const content = type === "privacy" ? PRIVACY_CONTENT : TERMS_CONTENT;
    const title = type === "privacy" ? "Privacy Policy" : "Terms of Service";
    return (
        <>
            <div className="profile-header">
                <button className="nav-icon-btn" onClick={onBack}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 18 9 12 15 6"></polyline>
                    </svg>
                </button>
                <h2>{title}</h2>
                <button className="nav-icon-btn" style={{ fontSize: "16px", fontWeight: "600" }} onClick={onBack}>Done</button>
            </div>
            <div className="profile-scroll-area" style={{ padding: "20px 24px" }}>
                <p style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "20px" }}>Last updated: May 2026 · PhysioCare Platform</p>
                {content.map((section, i) => (
                    <div key={i} style={{ marginBottom: "20px" }}>
                        <h4 style={{ fontSize: "14px", fontWeight: "700", color: "#0f172a", marginBottom: "6px" }}>{section.heading}</h4>
                        <p style={{ fontSize: "13px", color: "#475569", lineHeight: "1.7", margin: 0 }}>{section.body}</p>
                    </div>
                ))}
                <div style={{ marginTop: "32px", padding: "16px", background: "#f8fafc", borderRadius: "12px", textAlign: "center" }}>
                    <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>© 2026 PhysioCare · All rights reserved</p>
                    <p style={{ fontSize: "12px", color: "#94a3b8", margin: "4px 0 0" }}>physiocare.in · support@physiocare.in</p>
                </div>
            </div>
        </>
    );
}

function UserProfileModal({ isOpen, onClose, role, isAvailable, handleToggleAvailability, togglingAvailability }) {
    const [user, setUser] = useState(null);
    const [doctorProfile, setDoctorProfile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [policyView, setPolicyView] = useState(null); // null | 'privacy' | 'terms'
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({});
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState("");

    const tokenKey = role === "doctor" ? "doctorToken" : "patientToken";

    const fetchUser = async (forceFresh = false) => {
        const token = localStorage.getItem(tokenKey);
        if (!token) { setLoading(false); return; }

        try {
            const payload = decodeToken(token);
            if (!user && !forceFresh) setLoading(true);

            if (payload.role === "doctor") {
                const [userData, profileData] = await Promise.all([
                    cachedFetch(`user:${payload.id}`, `${API_BASE_URL}/auth/${payload.id}`, { ttl: 30000 }),
                    cachedFetch(`doctor:${payload.id}`, `${API_BASE_URL}/doctors/${payload.id}`, { ttl: 30000 })
                ]);
                setUser(userData);
                setDoctorProfile(profileData);
            } else {
                const userData = await cachedFetch(`user:${payload.id}`, `${API_BASE_URL}/auth/${payload.id}`, { ttl: 30000 });
                setUser(userData);
            }
        } catch (error) {
            console.error("Error fetching user profile:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchUser();
        } else {
            setIsEditing(false);
            setSaveError("");
        }

        const handleProfileUpdate = () => {
            if (isOpen) fetchUser(true);
        };
        window.addEventListener("physiocare:profile-updated", handleProfileUpdate);
        return () => window.removeEventListener("physiocare:profile-updated", handleProfileUpdate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, tokenKey]);

    if (!isOpen) return null;

    const isDoctor = (user?.role || role) === "doctor";

    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            setPolicyView(null);
            setIsEditing(false);
            onClose();
        }
    };

    const startEditing = () => {
        setSaveError("");
        setEditForm({
            name: user?.name || "",
            phone: user?.phone || "",
            city: user?.city || "",
            profilePhoto: user?.profilePhoto || "",
            dateOfBirth: user?.dateOfBirth || "",
            gender: user?.gender || "",
            bloodGroup: user?.bloodGroup || "",
            currentCondition: user?.currentCondition || "",
            existingConditions: user?.existingConditions || "",
            pastSurgeries: user?.pastSurgeries || "",
            emergencyContactName: user?.emergencyContactName || "",
            emergencyContactNumber: user?.emergencyContactNumber || "",
            // Doctor fields
            specialization: doctorProfile?.specialization || "Physiotherapist",
            experience: doctorProfile?.experience || "0 Years",
            fees: doctorProfile?.fees || 0,
            bio: doctorProfile?.bio || doctorProfile?.about || "",
            licenceNumber: doctorProfile?.licenceNumber || "",
            hospitalName: doctorProfile?.hospitalName || ""
        });
        setIsEditing(true);
    };

    const handlePhotoChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const resized = await resizeImage(file, { maxWidth: 256, maxHeight: 256, quality: 0.8, format: "image/webp" });
            setEditForm(prev => ({ ...prev, profilePhoto: resized }));
        } catch (err) {
            console.error("Photo resize failed:", err);
            setSaveError("Could not process photo. Please choose a valid image.");
        }
    };

    const handleSaveProfile = async (e) => {
        e.preventDefault();
        setSaving(true);
        setSaveError("");
        const token = localStorage.getItem(tokenKey);
        if (!token) return;
        const payload = decodeToken(token);

        try {
            if (isDoctor) {
                // Update doctor user fields
                const userRes = await fetch(`${API_BASE_URL}/auth/${payload.id}/complete-profile`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: editForm.name,
                        phone: editForm.phone,
                        city: editForm.city,
                        profilePhoto: editForm.profilePhoto
                    })
                });
                if (!userRes.ok) {
                    const err = await userRes.json();
                    throw new Error(err.msg || "Failed to update profile details");
                }

                // Update doctor professional details
                const docRes = await fetch(`${API_BASE_URL}/doctors/${payload.id}/profile`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        experience: editForm.experience,
                        specialization: editForm.specialization,
                        fees: editForm.fees,
                        bio: editForm.bio,
                        about: editForm.bio,
                        hospitalName: editForm.hospitalName,
                        licenceNumber: editForm.licenceNumber
                    })
                });
                if (!docRes.ok) {
                    const err = await docRes.json();
                    throw new Error(err.msg || "Failed to update doctor details");
                }

                // Instant UI update
                setUser(prev => ({ ...prev, ...editForm }));
                setDoctorProfile(prev => ({ ...prev, ...editForm }));
            } else {
                // Patient profile update
                const res = await fetch(`${API_BASE_URL}/auth/${payload.id}/complete-profile`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(editForm)
                });
                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.msg || "Failed to update profile");
                }
                const data = await res.json();
                setUser(data.user || { ...user, ...editForm });
            }

            emitProfileUpdated(payload.id);
            setIsEditing(false);
        } catch (err) {
            console.error("Save profile error:", err);
            setSaveError(err.message || "Failed to save profile changes.");
        } finally {
            setSaving(false);
        }
    };

    const modalContent = (
        <div className="modal-overlay" onClick={handleOverlayClick}>
            <div className="modal-content profile-modal">

                {/* ── Policy Sub-view ── */}
                {policyView ? (
                    <PolicyView type={policyView} onBack={() => setPolicyView(null)} />
                ) : (
                    <>
                        {/* ── Profile Header ── */}
                        <div className="profile-header">
                            <button className="nav-icon-btn" onClick={onClose}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="15 18 9 12 15 6"></polyline>
                                </svg>
                            </button>
                            <h2>{isEditing ? "Edit Profile" : "Profile"}</h2>
                            {!isEditing ? (
                                <div style={{ display: "flex", gap: "8px" }}>
                                    <button
                                        className="nav-icon-btn"
                                        style={{ fontSize: "14px", fontWeight: "600", color: "var(--primary)" }}
                                        onClick={startEditing}
                                    >
                                        Edit
                                    </button>
                                    <button className="nav-icon-btn" style={{ fontSize: "14px", fontWeight: "600" }} onClick={onClose}>Done</button>
                                </div>
                            ) : (
                                <button
                                    className="nav-icon-btn"
                                    style={{ fontSize: "14px", fontWeight: "600", color: "#64748B" }}
                                    onClick={() => setIsEditing(false)}
                                >
                                    Cancel
                                </button>
                            )}
                        </div>

                        {/* ── Body ── */}
                        {loading ? (
                            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                                <div style={{ alignSelf: "center", width: "100px", height: "100px", borderRadius: "50%", backgroundColor: "#f1f5f9", animation: "skeleton-pulse 1.5s infinite" }} />
                                <div style={{ width: "60%", height: "24px", backgroundColor: "#f1f5f9", margin: "0 auto", borderRadius: "4px" }} />
                                <div style={{ width: "40%", height: "16px", backgroundColor: "#f1f5f9", margin: "0 auto", borderRadius: "4px" }} />
                            </div>
                        ) : isEditing ? (
                            /* ── Edit Profile Form ── */
                            <form className="profile-scroll-area" onSubmit={handleSaveProfile} style={{ padding: "20px 24px" }}>
                                {saveError && (
                                    <div style={{ padding: "10px 14px", background: "#fee2e2", color: "#991b1b", borderRadius: "8px", fontSize: "13px", marginBottom: "16px" }}>
                                        {saveError}
                                    </div>
                                )}

                                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "20px" }}>
                                    <div className="avatar-large" style={{ overflow: "hidden", borderRadius: "50%", border: "3px solid var(--primary-100)", width: "80px", height: "80px", marginBottom: "8px" }}>
                                        {editForm.profilePhoto ? (
                                            <img src={editForm.profilePhoto} alt="Profile preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                        ) : (
                                            <div style={{ width: "100%", height: "100%", background: "var(--gradient-brand)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "28px", fontWeight: "700" }}>
                                                {editForm.name?.charAt(0) || "U"}
                                            </div>
                                        )}
                                    </div>
                                    <label style={{ cursor: "pointer", fontSize: "13px", color: "var(--primary)", fontWeight: "600" }}>
                                        Change Photo (max 256x256)
                                        <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: "none" }} />
                                    </label>
                                </div>

                                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                                    <div>
                                        <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Name</label>
                                        <input
                                            type="text"
                                            value={editForm.name}
                                            onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                                            style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: "8px" }}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Phone</label>
                                        <input
                                            type="text"
                                            value={editForm.phone}
                                            onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                                            style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: "8px" }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>City</label>
                                        <input
                                            type="text"
                                            value={editForm.city}
                                            onChange={e => setEditForm({ ...editForm, city: e.target.value })}
                                            style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: "8px" }}
                                        />
                                    </div>

                                    {isDoctor ? (
                                        <>
                                            <div>
                                                <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Specialization</label>
                                                <input
                                                    type="text"
                                                    value={editForm.specialization}
                                                    onChange={e => setEditForm({ ...editForm, specialization: e.target.value })}
                                                    style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: "8px" }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Experience</label>
                                                <input
                                                    type="text"
                                                    value={editForm.experience}
                                                    onChange={e => setEditForm({ ...editForm, experience: e.target.value })}
                                                    placeholder="e.g. 5 Years"
                                                    style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: "8px" }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Consultation Fees (₹)</label>
                                                <input
                                                    type="number"
                                                    value={editForm.fees}
                                                    onChange={e => setEditForm({ ...editForm, fees: e.target.value })}
                                                    style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: "8px" }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Hospital / Clinic Name</label>
                                                <input
                                                    type="text"
                                                    value={editForm.hospitalName}
                                                    onChange={e => setEditForm({ ...editForm, hospitalName: e.target.value })}
                                                    style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: "8px" }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>About / Bio</label>
                                                <textarea
                                                    rows={3}
                                                    value={editForm.bio}
                                                    onChange={e => setEditForm({ ...editForm, bio: e.target.value })}
                                                    style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: "8px" }}
                                                />
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div>
                                                <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Date of Birth</label>
                                                <input
                                                    type="date"
                                                    value={editForm.dateOfBirth}
                                                    onChange={e => setEditForm({ ...editForm, dateOfBirth: e.target.value })}
                                                    style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: "8px" }}
                                                />
                                            </div>
                                            <div>
                                                <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Gender</label>
                                                <select
                                                    value={editForm.gender}
                                                    onChange={e => setEditForm({ ...editForm, gender: e.target.value })}
                                                    style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: "8px" }}
                                                >
                                                    <option value="">Select Gender</option>
                                                    <option value="Male">Male</option>
                                                    <option value="Female">Female</option>
                                                    <option value="Other">Other</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Current Condition</label>
                                                <input
                                                    type="text"
                                                    value={editForm.currentCondition}
                                                    onChange={e => setEditForm({ ...editForm, currentCondition: e.target.value })}
                                                    placeholder="e.g. Lower back pain"
                                                    style={{ width: "100%", padding: "10px 12px", border: "1px solid var(--border)", borderRadius: "8px" }}
                                                />
                                            </div>
                                        </>
                                    )}

                                    <button
                                        type="submit"
                                        disabled={saving}
                                        style={{
                                            marginTop: "16px",
                                            padding: "12px",
                                            background: saving ? "var(--primary-300)" : "var(--primary)",
                                            color: "white",
                                            fontWeight: "600",
                                            borderRadius: "8px",
                                            cursor: saving ? "not-allowed" : "pointer"
                                        }}
                                    >
                                        {saving ? "Saving..." : "Save Profile"}
                                    </button>
                                </div>
                            </form>
                        ) : user ? (
                            <div className="profile-scroll-area">
                                {/* Avatar */}
                                <div className="profile-avatar-section">
                                    {user.profilePhoto ? (
                                        <div className="avatar-large" style={{ overflow: "hidden", borderRadius: "50%", border: "4px solid white", boxShadow: "0 4px 10px rgba(0,0,0,0.1)" }}>
                                            <img src={user.profilePhoto} alt={user.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                        </div>
                                    ) : (
                                        <div className="avatar-large" style={{ padding: "10px", background: "var(--gradient-brand)", borderRadius: "50%", border: "4px solid white", boxShadow: "0 4px 10px rgba(0,0,0,0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "32px", fontWeight: "700" }}>
                                            {user.name?.charAt(0) || "U"}
                                        </div>
                                    )}
                                    <h3>{user.name}</h3>
                                    {isDoctor && (
                                        <>
                                            <p className="role-text">{doctorProfile?.specialization || "Physiotherapist"}</p>
                                            <p className="experience-text">{doctorProfile?.experience || "0 Years"} experience</p>
                                        </>
                                    )}
                                </div>

                                {isDoctor ? (
                                    <>
                                        {/* Availability Toggle */}
                                        {handleToggleAvailability && (
                                            <div className="availability-toggle" style={{ margin: "20px 0", padding: "16px", background: isAvailable ? "#dcfce7" : "#f1f5f9", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "space-between", border: `1px solid ${isAvailable ? "#bbf7d0" : "#e2e8f0"}` }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                                    <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: isAvailable ? "#22c55e" : "#94a3b8" }}></div>
                                                    <span style={{ fontSize: "15px", fontWeight: "600", color: isAvailable ? "#166534" : "#475569" }}>
                                                        {isAvailable ? "Available for Appointments" : "Not Available currently"}
                                                    </span>
                                                </div>
                                                <label className="toggle-switch">
                                                    <input type="checkbox" checked={isAvailable} onChange={handleToggleAvailability} disabled={togglingAvailability} />
                                                    <span className="slider"></span>
                                                </label>
                                            </div>
                                        )}

                                        {/* Personal Info */}
                                        <div className="profile-section">
                                            <h4>Personal Information</h4>
                                            <div className="info-card">
                                                <div className="info-row"><span className="label">Name</span><span className="value" style={{ color: "#0f172a" }}>{user.name}</span></div>
                                                <div className="info-row"><span className="label">Email</span><span className="value" style={{ color: "#0f172a" }}>{user.email}</span></div>
                                                <div className="info-row"><span className="label">Phone</span><span className="value" style={{ color: "#0f172a" }}>{user.phone || "Not set"}</span></div>
                                                <div className="info-row"><span className="label">City</span><span className="value" style={{ color: "#0f172a" }}>{user.city || "Not set"}</span></div>
                                            </div>
                                        </div>

                                        {/* Bio */}
                                        {(doctorProfile?.bio || doctorProfile?.about) && (
                                            <div className="profile-section">
                                                <h4>About</h4>
                                                <div className="info-card">
                                                    <p style={{ margin: 0, fontSize: "14px", color: "#334155", lineHeight: "1.6" }}>{doctorProfile.bio || doctorProfile.about}</p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Professional */}
                                        <div className="profile-section">
                                            <h4>Professional Information</h4>
                                            <div className="info-card">
                                                <div className="info-row"><span className="label">Experience</span><span className="value" style={{ color: "#0f172a" }}>{doctorProfile?.experience || "0 Years"}</span></div>
                                                <div className="info-row"><span className="label">Licence No.</span><span className="value" style={{ color: "#0f172a" }}>{doctorProfile?.licenceNumber || "Not set"}</span></div>
                                                <div className="info-row"><span className="label">Hospital / Clinic</span><span className="value" style={{ color: "#0f172a" }}>{doctorProfile?.hospitalName || "Not set"}</span></div>
                                                <div className="info-row"><span className="label">Consultation Fee</span><span className="value" style={{ color: "#0f172a" }}>₹{doctorProfile?.fees || 0}</span></div>
                                            </div>
                                        </div>

                                        {/* Schedule */}
                                        <div className="profile-section">
                                            <h4>Schedule &amp; Availability</h4>
                                            <div className="info-card">
                                                <div className="info-row">
                                                    <span className="label">Available Days</span>
                                                    <span className="value" style={{ color: "#0f172a" }}>{doctorProfile?.availableDays?.length > 0 ? doctorProfile.availableDays.join(", ") : "Not set"}</span>
                                                </div>
                                                <div className="info-row">
                                                    <span className="label">Working Hours</span>
                                                    <span className="value" style={{ color: "#0f172a" }}>
                                                        {doctorProfile?.availableTimeStart && doctorProfile?.availableTimeEnd
                                                            ? `${doctorProfile.availableTimeStart} - ${doctorProfile.availableTimeEnd}`
                                                            : "Not set"}
                                                    </span>
                                                </div>
                                                <div className="info-row">
                                                    <span className="label">Languages</span>
                                                    <span className="value" style={{ color: "#0f172a" }}>{doctorProfile?.languages?.length > 0 ? doctorProfile.languages.join(", ") : "Not set"}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        {/* Patient Personal Info */}
                                        <div className="profile-section" style={{ marginTop: "32px" }}>
                                            <div className="info-card" style={{ marginBottom: "24px" }}>
                                                <div className="info-row"><span className="label">Name</span><span className="value" style={{ color: "var(--primary)", fontWeight: "500" }}>{user.name}</span></div>
                                                <div className="info-row"><span className="label">Email</span><span className="value" style={{ color: "var(--primary)", fontWeight: "500" }}>{user.email}</span></div>
                                                <div className="info-row"><span className="label">Phone</span><span className="value" style={{ color: "var(--primary)", fontWeight: "500" }}>{user.phone || "Not set"}</span></div>
                                                <div className="info-row"><span className="label">Gender</span><span className="value" style={{ color: "var(--primary)", fontWeight: "500" }}>{user.gender || "Not set"}</span></div>
                                                <div className="info-row"><span className="label">Date of Birth</span><span className="value" style={{ color: "var(--primary)", fontWeight: "500" }}>{user.dateOfBirth || "Not set"}</span></div>
                                                <div className="info-row"><span className="label">Blood Group</span><span className="value" style={{ color: "var(--primary)", fontWeight: "500" }}>{user.bloodGroup || "Not set"}</span></div>
                                            </div>

                                            {/* Health Details */}
                                            <h4>Health Details</h4>
                                            <div className="info-card" style={{ marginBottom: "24px" }}>
                                                <div className="info-row"><span className="label">Current Condition</span><span className="value" style={{ color: "var(--primary)", fontWeight: "500" }}>{user.currentCondition || "Not set"}</span></div>
                                                <div className="info-row"><span className="label">Existing Conditions</span><span className="value" style={{ color: "var(--primary)", fontWeight: "500" }}>{user.existingConditions || "Not set"}</span></div>
                                                <div className="info-row"><span className="label">Past Surgeries</span><span className="value" style={{ color: "var(--primary)", fontWeight: "500" }}>{user.pastSurgeries || "Not set"}</span></div>
                                            </div>

                                            {/* Emergency Contact */}
                                            <h4>Emergency Contact</h4>
                                            <div className="info-card">
                                                <div className="info-row"><span className="label">Contact Name</span><span className="value" style={{ color: "var(--primary)", fontWeight: "500" }}>{user.emergencyContactName || "Not set"}</span></div>
                                                <div className="info-row"><span className="label">Contact Number</span><span className="value" style={{ color: "var(--primary)", fontWeight: "500" }}>{user.emergencyContactNumber || "Not set"}</span></div>
                                            </div>
                                        </div>

                                        {/* Settings */}
                                        <div className="profile-section">
                                            <h4>Settings</h4>
                                            <div className="info-card">
                                                <div className="info-row"><span className="label">Location</span><span className="value" style={{ color: "var(--primary)", fontWeight: "500" }}>{user.city || "Not set"}</span></div>
                                                <div className="info-row">
                                                    <span className="label">Notification</span>
                                                    <div className="value">
                                                        <label className="toggle-switch">
                                                            <input type="checkbox" defaultChecked={false} />
                                                            <span className="slider"></span>
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* Privacy & Security — shown for both patient and doctor */}
                                <div className="profile-section">
                                    <h4>Privacy &amp; Security</h4>
                                    <div
                                        className="pill-link"
                                        onClick={() => setPolicyView("privacy")}
                                        style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                                    >
                                        <span>Privacy Policy</span>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                                    </div>
                                    <div
                                        className="pill-link"
                                        onClick={() => setPolicyView("terms")}
                                        style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                                    >
                                        <span>Terms of Service</span>
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                                    </div>
                                </div>

                                {/* Logout */}
                                <div className="logout-container">
                                    <button className="logout-btn" onClick={() => { localStorage.removeItem(tokenKey); window.location.href = "/"; }}>
                                        Logout
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <p style={{ textAlign: "center", marginTop: "20px" }}>Could not load user data.</p>
                        )}
                    </>
                )}

            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}

export default UserProfileModal;
