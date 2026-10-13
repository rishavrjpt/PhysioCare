import Layout from "../components/Layout";
import { decodeToken } from "../utils/auth";
import { useNavigate } from "react-router-dom";
import "../style/home.css";

import physio from "../assets/patient.jpg";

import { useState, useRef, useEffect, useCallback } from "react";
import DoctorProfileModal from "../components/DoctorProfileModal";
import EmptyState from "../components/EmptyState";
import { API_BASE_URL } from "../config";
import { cachedFetch, invalidate } from "../utils/dataStore";

function Home() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const inputRef = useRef(null);

  const [doctors, setDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [patientCity, setPatientCity] = useState("");
  const [appointmentStats, setAppointmentStats] = useState({ done: 0, pending: 0, adherence: 0 });
  const [latestSession, setLatestSession] = useState(null);

  // ─── Enroll in program (Optimistic UI) ──────────────────────────────────────
  const verifyCode = async () => {
    if (!code) { setMessage("Please enter a code"); return; }
    const token = localStorage.getItem("patientToken");
    if (!token) { setMessage("Please log in first"); return; }
    const payload = decodeToken(token);

    setEnrolling(true);
    const enteredCode = code.trim().toUpperCase();
    setMessage(`Unlocking program ${enteredCode}...`);

    try {
      const response = await fetch(`${API_BASE_URL}/programs/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: payload.id, programCode: enteredCode })
      });
      const data = await response.json();
      if (response.ok) {
        setMessage(`Program Unlocked ✅ - ${data.program?.title}`);
        setCode("");
      } else {
        setMessage(`Error ❌: ${data.msg || "Failed to enroll"}`);
      }
    } catch {
      setMessage("Server error ❌");
    } finally {
      setEnrolling(false);
    }
  };

  const loadDoctors = useCallback(async (cityToUse = "", forceFresh = false) => {
    if (forceFresh) {
      invalidate("doctors:");
    }
    const docKey = `doctors:${cityToUse || "all"}`;
    const url = `${API_BASE_URL}/doctors${cityToUse ? `?city=${encodeURIComponent(cityToUse)}` : ""}`;
    try {
      const data = await cachedFetch(docKey, url, { ttl: 30000 });
      if (Array.isArray(data) && data.length > 0) {
        setDoctors(data);
      } else if (cityToUse) {
        // Fallback to all doctors if city had 0
        const fallback = await cachedFetch("doctors:all", `${API_BASE_URL}/doctors`, { ttl: 30000 });
        setDoctors(Array.isArray(fallback) ? fallback : []);
      } else {
        setDoctors([]);
      }
    } catch (e) {
      console.error("Doctor fetch error:", e);
    } finally {
      setLoadingDoctors(false);
    }
  }, []);

  // ─── Fetch all dashboard data in parallel ───────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem("patientToken");
    if (!token) { setLoadingDoctors(false); return; }
    const payload = decodeToken(token);
    const pid = payload.id;

    // Parallel fetch: patient details, doctor list, appointments
    const loadAll = async () => {
      try {
        // 1. Fetch user to get city
        cachedFetch(`user:${pid}`, `${API_BASE_URL}/auth/${pid}`, { ttl: 30000 })
          .then(userData => {
            const city = userData?.city || "";
            if (city) setPatientCity(city);
            loadDoctors(city);
          })
          .catch(() => loadDoctors(""));

        // 2. Appointments (fresh)
        fetch(`${API_BASE_URL}/appointments/patient/${pid}`)
          .then(res => res.ok ? res.json() : [])
          .then(apptData => {
            if (Array.isArray(apptData)) {
              let done = 0, pending = 0;
              let completed = [];
              apptData.forEach(app => {
                if (app.status === "Confirmed" || app.status === "Completed") done++;
                if (app.status === "Pending") pending++;
                if (app.status === "Completed") completed.push(app);
              });
              const total = done + pending;
              setAppointmentStats({ done, pending, adherence: total > 0 ? Math.round((done / total) * 100) : 0 });
              if (completed.length > 0) {
                completed.sort((a, b) => new Date(b.date) - new Date(a.date));
                setLatestSession(completed[0]);
              }
            }
          })
          .catch(e => console.error("Appointments fetch error:", e));
      } catch (err) {
        console.error("Dashboard error:", err);
      }
    };

    loadAll();

    // Live profile update listener
    const onProfileUpdate = () => {
      loadDoctors(patientCity, true);
    };
    window.addEventListener("physiocare:profile-updated", onProfileUpdate);

    // Refetch doctor list when user returns to this browser tab
    const onFocus = () => {
      loadDoctors(patientCity, true);
    };
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("physiocare:profile-updated", onProfileUpdate);
      window.removeEventListener("focus", onFocus);
    };
  }, [loadDoctors, patientCity]);

  return (
    <Layout>
      <div className="patient-dashboard">

        {/* ── LEFT COLUMN ────────────────────────────────────────────────── */}
        <div className="dashboard-main-left">

          {/* Book visits banner */}
          <div className="book-visits-card">
            <div className="visit-image-container">
              <img src={physio} alt="Certified Physiotherapist" className="physio-img" />
            </div>
            <div className="visit-text-content">
              <div className="banner-date">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</div>
              <h2>Book home visits</h2>
              <p>Get certified physiotherapy at your doorsteps. Professional care tailored to your recovery needs in the comfort of your home.</p>
              <button className="btn-book-appointment" onClick={() => navigate('/appointments')}>Book appointment</button>
            </div>
          </div>

          {/* Find Doctors */}
          <div>
            <div className="section-header" style={{ marginBottom: '16px' }}>
              <h3>
                Find Doctors{patientCity && <span style={{ fontSize: '14px', fontWeight: '500', color: '#64748b', marginLeft: '6px' }}>in {patientCity}</span>}
              </h3>
              <span className="view-all" onClick={() => navigate('/appointments')}>View all</span>
            </div>

            <div className="doctors-grid">
              {loadingDoctors ? (
                [1, 2, 3, 4].map(n => (
                  <div key={n} style={{ background: '#f8fafc', borderRadius: '16px', height: '200px', animation: 'shimmer 1.5s infinite' }} />
                ))
              ) : doctors.length === 0 ? (
                <div style={{ gridColumn: '1 / -1' }}>
                  <EmptyState icon="calendar" title="No doctors found" message="We couldn't find any physiotherapists registered in this city yet." />
                </div>
              ) : (
                doctors.map(doctor => (
                  <div key={doctor._id} className="doctor-card" onClick={() => setSelectedDoctor(doctor)}>
                    <div className="doctor-avatar" style={{ position: 'relative' }}>
                      <img src={physio} alt={doctor.name} />
                      <div style={{
                        position: 'absolute', bottom: '-10px', left: '50%', transform: 'translateX(-50%)',
                        backgroundColor: doctor.profile?.isAvailable ? '#dcfce7' : '#fee2e2',
                        color: doctor.profile?.isAvailable ? '#166534' : '#991b1b',
                        border: `1px solid ${doctor.profile?.isAvailable ? '#bbf7d0' : '#fecaca'}`,
                        padding: '2px 8px', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold', whiteSpace: 'nowrap'
                      }}>
                        {doctor.profile?.isAvailable ? 'Available' : 'Not Available'}
                      </div>
                    </div>
                    <div className="doctor-info">
                      <h4>{doctor.name}</h4>
                      <p className="doctor-specialization">{doctor.profile?.specialization || "Physiotherapist"}</p>
                      <p style={{ fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px', justifyContent: 'center' }}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                        {doctor.city || "Location not set"}
                      </p>
                      <p className="doctor-exp">{doctor.profile?.experience || "0 Years"} Experience</p>
                      <div className="doctor-stats">
                        <span>⭐ {doctor.profile?.rating || 0}</span>
                        <span>👥 {doctor.profile?.patientsCount || "0+"} Patients</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* ── RIGHT SIDEBAR ──────────────────────────────────────────────── */}
        <div className="dashboard-sidebar-right">
          <div className="tracker-card">
            <h3>Progress Tracker</h3>

            {/* Circular progress */}
            <div className="progress-circle" style={{ position: 'relative', width: '130px', height: '130px', margin: '0 auto 16px' }}>
              <svg width="130" height="130" viewBox="0 0 130 130" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="65" cy="65" r="54" fill="none" stroke="var(--primary-100)" strokeWidth="12" />
                <circle
                  cx="65" cy="65" r="54"
                  fill="none"
                  stroke="var(--primary)"
                  strokeWidth="12"
                  strokeDasharray="339"
                  strokeDashoffset={339 - (339 * (appointmentStats.adherence / 100))}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dashoffset 0.6s ease" }}
                />
              </svg>
              <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)' }}>
                {appointmentStats.adherence}%
              </div>
            </div>

            <div className="adherence-label">
              <span className="teal-dot"></span> Weekly Adherence
            </div>

            {/* Week pills */}
            <div className="weeks-container">
              <span className="week-pill active">W1</span>
              <span className="week-pill">W2</span>
              <span className="week-pill">W3</span>
              <span className="week-pill">W4</span>
            </div>

            {/* Stats */}
            <div className="stats-row">
              <div className="stat-box blue-box">
                <h2>{appointmentStats.done}</h2>
                <p>Sessions Done</p>
              </div>
              <div className="stat-box purple-box">
                <h2>{appointmentStats.pending}</h2>
                <p>Pending</p>
              </div>
            </div>

            {/* Doctor's suggestion */}
            {latestSession?.suggestion && (
              <div style={{ background: 'var(--primary-50)', padding: '14px 16px', borderRadius: '12px', marginBottom: '16px', width: '100%', boxSizing: 'border-box' }}>
                <h4 style={{ margin: '0 0 6px', fontSize: '13px', color: 'var(--primary-hover)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4"></path><path d="M12 8h.01"></path></svg>
                  Doctor's Suggestion
                </h4>
                <p style={{ margin: 0, fontSize: '13px', color: '#334155', lineHeight: '1.5' }}>{latestSession.suggestion}</p>
              </div>
            )}

            {/* Program code card */}
            <div className="program-code-card">
              <h4>Enter your program code</h4>
              <p>Unlock your personalized video program.</p>
              <div className="input-group">
                <input
                  type="text"
                  placeholder="Enter your code"
                  ref={inputRef}
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && verifyCode()}
                />
                <button onClick={verifyCode} disabled={enrolling}>
                  {enrolling ? "Unlocking..." : "Verify"}
                </button>
              </div>
              {message && <p className="code-message">{message}</p>}
            </div>

          </div>
        </div>

      </div>

      {selectedDoctor && (
        <DoctorProfileModal doctor={selectedDoctor} onClose={() => setSelectedDoctor(null)} />
      )}
    </Layout>
  );
}

export default Home;