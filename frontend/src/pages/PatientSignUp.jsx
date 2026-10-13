import { useNavigate } from "react-router-dom";
import { useState } from "react";
import "../style/patientSignUp.css";
import { API_BASE_URL } from "../config";

import physio from "../assets/patient.jpg"; // Using existing asset

function PatientSignUp() {
    const navigate = useNavigate();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [error, setError] = useState("");

    const handleSignup = async () => {
        if (password !== confirmPassword) {
            setError("Passwords do not match");
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
                    role: "patient"
                })
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.msg || "Signup failed");
                return;
            }
            // Redirect to OTP verification
            const devOtpQuery = data.devOtp ? `&devOtp=${encodeURIComponent(data.devOtp)}` : "";
            navigate(`/verify-otp?email=${encodeURIComponent(email)}&role=patient${devOtpQuery}`);
        } catch (err) {
            console.error(err);
            setError("Server error");
        }
    };

    return (
        <div className="signup-page-container">
            {/* NAVBAR */}
            <nav className="signup-navbar">
                <div className="nav-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="6" width="18" height="15" rx="2" ry="2" fill="var(--primary-100)" />
                        <path d="M8 6V4c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2v2" />
                        <line x1="12" y1="10" x2="12" y2="16" />
                        <line x1="9" y1="13" x2="15" y2="13" />
                    </svg>
                    <span className="logo-text">PhysioCare</span>
                </div>
                <div className="nav-actions">
                    <button className="icon-btn"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg></button>
                    <button className="icon-btn"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8"></polygon></svg></button>
                    <button className="icon-btn"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg></button>
                    <div className="vertical-divider"></div>
                    <button className="login-text-btn" onClick={() => navigate('/patient')}>Log in</button>
                </div>
            </nav>

            {/* MAIN CONTENT */}
            <div className="signup-main-content">

                {/* LEFT COLUMN */}
                <div className="signup-left-col">
                    <div className="signup-hero-text">
                        <h1>Join PhysioCare for <br />personalized <span>physiotherapy</span></h1>
                        <p>
                            Sign up as a patient to get access to expert physiotherapy<br />
                            plans, track your progress, and improve your recovery journey.
                        </p>
                    </div>

                    <div className="signup-feature-card">
                        <div className="feature-illustration">
                            <img src={physio} alt="Physiotherapist" className="physio-promo-img" />
                            <div className="clipboard-graphic">
                                <svg width="60" height="80" viewBox="0 0 60 80" fill="none">
                                    <rect x="5" y="10" width="50" height="70" rx="8" fill="var(--primary-100)" stroke="var(--primary-200)" strokeWidth="4" />
                                    <rect x="20" y="5" width="20" height="10" rx="4" fill="var(--primary-400)" />
                                    <rect x="15" y="30" width="10" height="10" rx="2" fill="var(--primary-400)" />
                                    <rect x="15" y="45" width="10" height="10" rx="2" fill="#fff" stroke="var(--primary-400)" strokeWidth="2" />
                                    <rect x="15" y="60" width="10" height="10" rx="2" fill="#fff" stroke="var(--primary-400)" strokeWidth="2" />
                                    <line x1="32" y1="35" x2="48" y2="35" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" />
                                    <line x1="32" y1="50" x2="48" y2="50" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" />
                                    <line x1="32" y1="65" x2="48" y2="65" stroke="#e2e8f0" strokeWidth="3" strokeLinecap="round" />
                                    <path d="M17 35 l2 2 l4 -4" stroke="white" strokeWidth="2" strokeLinecap="round" />
                                    <circle cx="55" cy="40" r="12" fill="#4ade80" />
                                    <path d="M50 40 l3 3 l5 -5" stroke="white" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                            </div>
                        </div>

                        <div className="feature-icons-row">
                            <div className="feature-item">
                                <div className="feature-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg></div>
                                <span><strong>Secure</strong> & Confidential</span>
                            </div>
                            <div className="feature-item">
                                <div className="feature-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg></div>
                                <span>Access Video Exercises</span>
                            </div>
                            <div className="feature-item">
                                <div className="feature-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg></div>
                                <span>Track Your Progress</span>
                            </div>
                            <div className="feature-item">
                                <div className="feature-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg></div>
                                <span><strong>Expert</strong> Physiotherapists</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN (FORM) */}
                <div className="signup-right-col">
                    <form className="signup-form-card" autoComplete="off" onSubmit={(e) => { e.preventDefault(); handleSignup(); }}>
                        <h2>Sign Up</h2>

                        <div className="input-with-icon">
                            <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                            <input type="text" placeholder="Full Name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
                        </div>

                        <div className="input-with-icon">
                            <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path><polyline points="22,6 12,13 2,6"></polyline></svg>
                            <input type="email" placeholder="Email address" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />
                        </div>

                        <div className="input-with-icon">
                            <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                            <input type="password" placeholder="Password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                        </div>

                        <div className="input-with-icon">
                            <svg className="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                            <input type="password" placeholder="Confirm password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                        </div>

                        {error && <p style={{ color: "red", fontSize: "14px", marginTop: "4px" }}>{error}</p>}

                        <div className="terms-checkbox">
                            <input type="checkbox" id="terms" defaultChecked />
                            <label htmlFor="terms">
                                I agree to the <a href="#">Terms of Service</a> and <a href="#">Privacy Policy</a>
                            </label>
                        </div>

                        <button type="submit" className="btn-signup-submit">Sign Up</button>

                        <p className="login-prompt">
                            Already have an account? <span onClick={() => navigate('/patient')} style={{ cursor: 'pointer', color: 'var(--primary)', fontWeight: '600' }}>Log in</span>
                        </p>
                    </form>
                </div>

            </div>

            {/* FOOTER */}
            <footer className="signup-footer">
                <div className="footer-left">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>
                    <span>User</span>
                </div>
                <div className="footer-center-links">
                    <span>Privacy Policy</span>
                    <span>Terms of Service</span>
                    <span>Help Center</span>
                </div>
            </footer>
        </div>
    );
}

export default PatientSignUp;
