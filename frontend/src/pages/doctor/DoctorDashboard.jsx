import { useState, useEffect } from "react";
import { decodeToken } from "../../utils/auth";
import { useNavigate } from "react-router-dom";
import DoctorSidebar from "../../components/DoctorSidebar";
import EmptyState from "../../components/EmptyState";
import "../../style/doctor/doctorDashboard.css";
import { API_BASE_URL } from "../../config";

function DoctorDashboard() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [doctorName, setDoctorName] = useState("Doctor");
  const [programCount, setProgramCount] = useState(0);
  const [articleCount, setArticleCount] = useState(0);

  const loadDashboardData = async () => {
    const token = localStorage.getItem("doctorToken");
    let doctorId = null;
    if (token) {
      const payload = decodeToken(token);
      doctorId = payload?.id;
    }

    if (!doctorId) {
      setLoading(false);
      return;
    }

    try {
      await Promise.allSettled([
        fetch(`${API_BASE_URL}/auth/${doctorId}`).then(async res => {
          if (res.ok) {
            const userData = await res.json();
            if (userData?.name) setDoctorName(userData.name);
          }
        }),
        fetch(`${API_BASE_URL}/appointments/doctor/${doctorId}`).then(async res => {
          if (res.ok) {
            const data = await res.json();
            setAppointments(Array.isArray(data) ? data : []);
          }
        }),
        fetch(`${API_BASE_URL}/programs/doctor/${doctorId}`).then(async res => {
          if (res.ok) {
            const progData = await res.json();
            setProgramCount(Array.isArray(progData) ? progData.length : 0);
          }
        }),
        fetch(`${API_BASE_URL}/articles/doctor/${doctorId}`).then(async res => {
          if (res.ok) {
            const artData = await res.json();
            setArticleCount(Array.isArray(artData) ? artData.length : 0);
          }
        })
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();

    const handleUpdate = () => {
      loadDashboardData();
    };
    window.addEventListener("physiocare:profile-updated", handleUpdate);
    return () => window.removeEventListener("physiocare:profile-updated", handleUpdate);
  }, []);

  const uniquePatients = [];
  const handledIds = new Set();
  appointments.forEach(app => {
    if (app.patientId && app.patientId._id && !handledIds.has(app.patientId._id)) {
      handledIds.add(app.patientId._id);
      uniquePatients.push(app.patientId);
    }
  });

  const upcomingAppointments = appointments.filter(a => a.status === "Confirmed").slice(0, 5);

  // Process engagement data (Appointments per day of week)
  const engagementData = { MON: 0, TUE: 0, WED: 0, THU: 0, FRI: 0, SAT: 0, SUN: 0 };
  appointments.forEach(app => {
    if (app.date) {
      const dateObj = new Date(app.date);
      if (!isNaN(dateObj.getTime())) {
        const dayStr = dateObj.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
        if (engagementData[dayStr] !== undefined) {
          engagementData[dayStr]++;
        }
      }
    }
  });

  const maxEng = Math.max(...Object.values(engagementData), 10); // Minimum scale 10
  const yAxisSteps = [
    maxEng,
    Math.round(maxEng * 0.75),
    Math.round(maxEng * 0.5),
    Math.round(maxEng * 0.25),
    0
  ];
  const maxActualCount = Math.max(...Object.values(engagementData));

  return (
    <div className="dashboard">
      {/* SIDEBAR */}
      <DoctorSidebar />

      {/* MAIN */}
      <div className="main">
        <div className="content">

          {/* TOPBAR — search removed */}
          <div className="topbar">
            <div style={{ flex: 1 }} />

            <div className="top-right">
              <div className="location">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                <span>Chennai</span>
              </div>
              <div className="divider"></div>
              <div className="icon-btn notification">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                <span className="badge">8</span>
              </div>
            </div>
          </div>

          {/* MAIN GRID */}
          <div className="dashboard-grid">
            {/* LEFT COLUMN */}
            <div className="left-column">

              {/* WELCOME BANNER */}
              <div className="welcome-banner">
                <div className="welcome-text">
                  <div className="banner-date">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</div>
                  <h2>Welcome back, <span className="highlight">{doctorName}</span></h2>
                  <p>Here's what's happening with your patients today.</p>
                </div>
                <div className="welcome-image">
                  {/* Abstract illustration representation */}
                  <svg width="120" height="100" viewBox="0 0 120 100" fill="none">
                    <rect x="20" y="10" width="60" height="80" rx="8" fill="#fff" stroke="var(--primary-100)" strokeWidth="4" />
                    <circle cx="50" cy="40" r="12" fill="#dcfce7" />
                    <path d="M45 40l3 3 7-7" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <rect x="35" y="65" width="30" height="4" rx="2" fill="#e2e8f0" />
                    <rect x="35" y="75" width="20" height="4" rx="2" fill="#e2e8f0" />
                    <rect x="70" y="55" width="40" height="35" rx="4" fill="var(--primary-400)" opacity="0.8" />
                    <rect x="70" y="72" width="40" height="2" fill="#fff" opacity="0.5" />
                  </svg>
                </div>
              </div>

              {/* METRICS & MY PATIENTS */}
              <div className="metrics-patients-section">
                <div className="section-header">
                  <h3>Practice Overview</h3>
                </div>

                <div className="metric-cards">
                  {/* Card 1 — Active Programs (real data) */}
                  <div className="metric-card" onClick={() => navigate('/doctor/programs')} style={{ cursor: 'pointer' }}>
                    <div className="metric-icon green">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                    </div>
                    <div className="metric-info">
                      <p>Active Programs</p>
                      <div className="metric-value">
                        <h2>{loading ? '—' : programCount}</h2>
                        <span className="trend neutral">programs</span>
                      </div>
                    </div>
                    <div className="chevron">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </div>
                  </div>

                  {/* Card 2 — Total Articles (real data) */}
                  <div className="metric-card" onClick={() => navigate('/doctor/articles')} style={{ cursor: 'pointer' }}>
                    <div className="metric-icon blue">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
                    </div>
                    <div className="metric-info">
                      <p>Total Articles</p>
                      <div className="metric-value">
                        <h2>{loading ? '—' : articleCount}</h2>
                        <span className="trend neutral">published</span>
                      </div>
                    </div>
                    <div className="chevron">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                    </div>
                  </div>
                </div>

                <div className="section-header mt-4">
                  <h3>My Patients</h3>
                  <a href="#" className="view-all">View All</a>
                </div>

                <div className="patient-list">
                  {uniquePatients.length === 0 && !loading && (
                    <EmptyState icon="folder" title="No patients yet" message="Patients who book appointments with you will appear here." />
                  )}
                  {loading && <p style={{ padding: '0 20px', fontSize: '14px', color: '#64748b' }}>Loading patients...</p>}
                  {uniquePatients.slice(0, 5).map(patient => (
                    <div className="patient-item" key={patient._id}>
                      <img src={`https://ui-avatars.com/api/?name=${patient.name}&background=random`} alt={patient.name} className="patient-avatar" />
                      <div className="patient-details">
                        <h4>{patient.name}</h4>
                        <p className="treatment">Patient</p>
                        <p className="activity">Linked via appointment</p>
                      </div>
                      <div className="chevron">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                      </div>
                    </div>
                  ))}
                </div>

              </div>

            </div>

            {/* RIGHT COLUMN */}
            <div className="right-column">

              <div className="appointments-section">
                <div className="section-header">
                  <h3>Upcoming Appointments</h3>
                  <a href="#" className="view-all">View All</a>
                </div>

                <div className="appointment-list">
                  {upcomingAppointments.length === 0 && !loading && (
                    <EmptyState icon="calendar" title="No upcoming appointments" message="You don't have any confirmed appointments scheduled right now." />
                  )}
                  {loading && <p style={{ padding: '0 16px', fontSize: '14px', color: '#64748b' }}>Loading appointments...</p>}
                  {upcomingAppointments.map((app, index) => (
                    <div key={app._id}>
                      <div className="appointment-item">
                        <div className="appointment-user">
                          <img src={`https://ui-avatars.com/api/?name=${app.patientId?.name || 'Unknown'}&background=random`} alt={app.patientId?.name} className="patient-avatar" />
                          <div className="appointment-info">
                            <h4>{app.patientId?.name || 'Unknown'}</h4>
                            <p className="time">{app.date} • {app.time}</p>
                            <div className="tags">
                              <span className="tag blue-tag">CONFIRMED</span>
                            </div>
                          </div>
                        </div>
                      </div>
                      {index < upcomingAppointments.length - 1 && <div className="divider-line"></div>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="engagement-section">
                <div className="section-header">
                  <h3>Patient Engagement</h3>
                </div>
                <div className="chart-container">
                  {/* Y-axis */}
                  <div className="y-axis">
                    <span>{yAxisSteps[0]}</span>
                    <span>{yAxisSteps[1]}</span>
                    <span>{yAxisSteps[2]}</span>
                    <span>{yAxisSteps[3]}</span>
                    <span>0</span>
                  </div>
                  {/* Bars */}
                  <div className="chart-bars-area">
                    {/* Grid lines */}
                    <div className="grid-lines">
                      <div className="grid-line"></div>
                      <div className="grid-line"></div>
                      <div className="grid-line"></div>
                      <div className="grid-line"></div>
                      <div className="grid-line"></div>
                    </div>
                    {Object.keys(engagementData).map(day => {
                      const count = engagementData[day];
                      const heightPercent = maxEng > 0 ? (count / maxEng) * 100 : 0;
                      const isActive = count === maxActualCount && count > 0;
                      return (
                        <div className="bar-group" key={day} title={`${count} appointments`}>
                          <div className={`bar ${isActive ? 'active' : ''}`} style={{ height: `${heightPercent}%` }}></div>
                          <span className="x-label">{day}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

export default DoctorDashboard;