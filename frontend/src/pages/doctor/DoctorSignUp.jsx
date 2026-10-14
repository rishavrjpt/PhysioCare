import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../style/doctorSignUp.css";
import { API_BASE_URL } from "../../config";

import { describeRequestError } from "../../utils/apiError";
import physio from "../../assets/patient.jpg"; // Re-using existing asset for image

function DoctorSignUp() {
    const navigate = useNavigate();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [specialization, setSpecialization] = useState("");
    const [error, setError] = useState("");

    const handleSignup = async () => {
        if (password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }
        if (!specialization) {
            setError("Please select a specialization");
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/auth/signup`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    name,
                    email,
                    password,
                    role: "doctor"
                })
            });

            const data = await res.json();
            if (!res.ok) {
                setError(data.msg || "Signup failed");
                return;
            }
            // Redirect to OTP verification
            const devOtpQuery = data.devOtp ? `&devOtp=${encodeURIComponent(data.devOtp)}` : "";
            navigate(`/verify-otp?email=${encodeURIComponent(email)}&role=doctor${devOtpQuery}`);
        } catch (err) {
            console.error(err);
            setError(describeRequestError(err));
        }
    };

    return (
        <div className="doc-signup-page-wrapper">

            {/* NAVBAR */}
            <nav className="doc-signup-top-nav">
                <div className="nav-logo-box" onClick={() => navigate('/')}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="6" width="18" height="15" rx="2" ry="2" fill="var(--primary-100)" />
                        <path d="M8 6V4c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2v2" />
                        <line x1="12" y1="10" x2="12" y2="16" />
                        <line x1="9" y1="13" x2="15" y2="13" />
                    </svg>
                    <span className="logo-brand-text">PhysioCare</span>
                </div>
                <div className="nav-actions-box"></div>
            </nav>

            {/* MAIN CONTENT */}
            <div className="doc-signup-content-grid">

                {/* LEFT COLUMN */}
                <div className="doc-signup-left-col">

                    <div className="doc-signup-text">
                        <h2>Join PhysioCare as a <br /><span>Physiotherapist</span></h2>
                        <p>
                            Sign up to provide expert physiotherapy sessions<br />
                            and manage your patients with our advanced platform.
                        </p>
                    </div>

                    <div className="doc-signup-image-card">
                        <img src={physio} alt="Physiotherapist" />
                    </div>

                </div>

                {/* RIGHT COLUMN */}
                <div className="doc-signup-form-wrapper">
                    <form className="doc-signup-action-card" autoComplete="off" onSubmit={(e) => { e.preventDefault(); handleSignup(); }}>
                        <h2 className="signup-title">Sign Up</h2>

                        <div className="form-group-box">
                            <div className="input-field-wrap">
                                <svg className="field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                <input type="text" placeholder="Full Name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
                            </div>
                        </div>

                        <div className="form-group-box">
                            <div className="input-field-wrap">
                                <svg className="field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                                <input type="email" placeholder="Email address" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
                            </div>
                        </div>

                        <div className="form-group-box">
                            <div className="input-field-wrap">
                                <svg className="field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                <input type="password" placeholder="Create Password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                            </div>
                        </div>

                        <div className="form-group-box">
                            <div className="input-field-wrap">
                                <svg className="field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                <input type="password" placeholder="Confirm Password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                            </div>
                        </div>

                        <div className="form-group-box">
                            <div className="input-field-wrap select-wrap">
                                <svg className="field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                                <select value={specialization} onChange={(e) => setSpecialization(e.target.value)}>
                                    <option value="" disabled>Specialization</option>
                                    <option value="Orthopedic">Orthopedic Physiotherapy</option>
                                    <option value="Neurological">Neurological Physiotherapy</option>
                                    <option value="Sports">Sports Physiotherapy</option>
                                    <option value="Pediatric">Pediatric Physiotherapy</option>
                                </select>
                                <svg className="select-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                            </div>
                        </div>

                        {error && <p style={{ color: "red", fontSize: "14px", marginTop: "-8px", marginBottom: "8px" }}>{error}</p>}

                        <div className="terms-checkbox-wrap">
                            <input type="checkbox" id="terms" defaultChecked />
                            <label htmlFor="terms">I agree to the <span>Terms of Service and Privacy Policy</span></label>
                        </div>

                        <button type="submit" className="submit-action-btn">Sign Up</button>

                        <div className="footer-links-row">
                            <span>Privacy Policy</span>
                            <span>Terms of Service</span>
                            <span>Help Center</span>
                        </div>

                    </form>
                </div>

            </div>

        </div>
    );
}

export default DoctorSignUp;
