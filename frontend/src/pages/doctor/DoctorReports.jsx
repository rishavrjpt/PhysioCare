import { useState, useEffect } from "react";
import { decodeToken } from "../../utils/auth";
import DoctorSidebar from "../../components/DoctorSidebar";
import { API_BASE_URL } from "../../config";
import "../../style/doctor/doctorReports.css";

function DoctorReports() {
    const [patients, setPatients] = useState([]);
    const [selectedPatientId, setSelectedPatientId] = useState("");
    const [adherenceScore, setAdherenceScore] = useState(0);
    const [appointments, setAppointments] = useState([]);
    const [enrolledProgramsCount, setEnrolledProgramsCount] = useState(0);
    const [doctorName, setDoctorName] = useState("Doctor");
    const [sentStatuses, setSentStatuses] = useState({}); // { appointmentId: true/false }
    const [sendConfirmModal, setSendConfirmModal] = useState(null); // { app } when open
    const [sending, setSending] = useState(false);

    const token = localStorage.getItem("doctorToken");
    let doctorId = null;
    if (token) {
        try {
            const payload = decodeToken(token);
            doctorId = payload.id;
        } catch (e) {
            console.error(e);
        }
    }

    useEffect(() => {
        if (!doctorId) return;

        // Fetch Doctor Profile for the name in the PDF
        const fetchDoctor = async () => {
             try {
                const res = await fetch(`${API_BASE_URL}/doctors/${doctorId}`);
                if (res.ok) {
                    const data = await res.json();
                    // /doctors/:id returns the name inside "user", not at the top level
                    setDoctorName(data.user?.name || data.name || "Doctor");
                }
             } catch (err) {
                console.error("Could not load doctor name:", err);
             }
        };
        fetchDoctor();

        const fetchAppointments = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/appointments/doctor/${doctorId}`);
                if (response.ok) {
                    const data = await response.json();
                    setAppointments(data);
                    
                    // Extract unique patients
                    const uniquePatientsMap = new Map();
                    data.forEach(app => {
                        if (app.patientId && !uniquePatientsMap.has(app.patientId._id)) {
                            uniquePatientsMap.set(app.patientId._id, app.patientId);
                        }
                    });
                    const uniquePatients = Array.from(uniquePatientsMap.values());
                    setPatients(uniquePatients);
                    
                    if (uniquePatients.length > 0) {
                        setSelectedPatientId(uniquePatients[0]._id);
                    }
                }
            } catch (error) {
                console.error("Error fetching appointments:", error);
            }
        };

        fetchAppointments();
    }, [doctorId]);

    useEffect(() => {
        if (!selectedPatientId || !doctorId) return;

        // Calculate adherence score
        const patientApps = appointments.filter(app => app.patientId && app.patientId._id === selectedPatientId);
        if (patientApps.length > 0) {
            const confirmed = patientApps.filter(app => app.status === "Confirmed" || app.status === "Completed").length;
            setAdherenceScore(Math.round((confirmed / patientApps.length) * 100));
        } else {
            setAdherenceScore(0);
        }

        // Fetch enrolled programs count
        const fetchPrograms = async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/programs/patient/${selectedPatientId}`);
                if (res.ok) {
                    const data = await res.json();
                    setEnrolledProgramsCount(data.length || 0);
                }
            } catch (error) {
                console.error("Error fetching enrolled programs:", error);
            }
        };
        fetchPrograms();
    }, [selectedPatientId, appointments, doctorId]);

    const patientApps = appointments.filter(app => app.patientId?._id === selectedPatientId).sort((a, b) => new Date(a.date) - new Date(b.date));
    const completedAppointmentsForPatient = patientApps.filter(app => app.status === "Completed").sort((a, b) => new Date(b.date) - new Date(a.date));

    // Initialise sentStatuses from loaded data
    useEffect(() => {
        if (completedAppointmentsForPatient.length > 0) {
            const initial = {};
            completedAppointmentsForPatient.forEach(app => {
                initial[app._id] = app.sentToPatient || false;
            });
            setSentStatuses(prev => ({ ...prev, ...initial }));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedPatientId, appointments]);

    // Opens the confirmation popup
    const openSendConfirm = (app) => {
        setSendConfirmModal(app);
    };

    const handleSendToPatient = async () => {
        if (!sendConfirmModal || sending) return;
        const appointmentId = sendConfirmModal._id;
        const previousStatus = sentStatuses[appointmentId];

        // Optimistically mark as sent and close modal
        setSentStatuses(prev => ({ ...prev, [appointmentId]: true }));
        setSendConfirmModal(null);
        setSending(true);

        try {
            const res = await fetch(`${API_BASE_URL}/appointments/${appointmentId}/send-to-patient`, {
                method: "PATCH"
            });
            if (!res.ok) {
                setSentStatuses(prev => ({ ...prev, [appointmentId]: previousStatus }));
                alert("Failed to send report. Please try again.");
            }
        } catch (e) {
            console.error("Error sending report:", e);
            setSentStatuses(prev => ({ ...prev, [appointmentId]: previousStatus }));
            alert("Network error sending report.");
        } finally {
            setSending(false);
        }
    };
    
    // Print View calculations
    const selectedPatient = patients.find(p => p._id === selectedPatientId);
    const patientName = selectedPatient?.name || "Unknown Patient";
    const displayPatientId = selectedPatientId ? `PT-${selectedPatientId.slice(-5).toUpperCase()}` : "PT-00000";
    
    // Get condition from the latest completed appointment's problem description, or fallback
    const latestProblem = completedAppointmentsForPatient.length > 0 && completedAppointmentsForPatient[0].problemDescription 
                            ? completedAppointmentsForPatient[0].problemDescription 
                            : "Neck & Head Pain";

    const totalSessions = patientApps.length;
    const completedCount = patientApps.filter(app => app.status === "Completed").length;
    const upcomingCount = patientApps.filter(app => app.status === "Confirmed" || app.status === "Pending").length;
    
    let avgRating = 0;
    const ratedApps = completedAppointmentsForPatient.filter(app => app.patientRating);
    if (ratedApps.length > 0) {
        const sum = ratedApps.reduce((acc, curr) => acc + curr.patientRating, 0);
        avgRating = (sum / ratedApps.length).toFixed(1);
    }

    // Dates for treatment period
    let treatmentPeriod = "N/A";
    if (patientApps.length > 0) {
        const firstDate = new Date(patientApps[0].date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const lastDate = new Date(patientApps[patientApps.length - 1].date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        treatmentPeriod = `${firstDate} — ${lastDate}`;
    }

    const reportGeneratedDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    // Calculate ring offset (251.2 is the total circumference)
    const ringOffset = 251.2 - (251.2 * adherenceScore) / 100;

    return (
        <div className="reports-page">
            <DoctorSidebar />

            <div className="main">
                <div className="content" id="report-content">

                    <div className="topbar">
                        <div className="top-spacing"></div>
                        <div className="top-right">
                            <div className="location">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                <span>Chennai</span>
                            </div>
                            <div className="divider"></div>
                            <div className="icon-btn notification">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                                <span className="badge">1</span>
                            </div>
                        </div>
                    </div>

                    <div className="page-header reports-header">
                        <div>
                            <h2>Reports</h2>
                            <p>Detailed patient performance analytics and progress tracking.</p>
                        </div>
                        <select 
                            className="patient-select-btn" 
                            value={selectedPatientId}
                            onChange={(e) => setSelectedPatientId(e.target.value)}
                            style={{ padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0", background: "white", cursor: "pointer", fontWeight: "600", color: "#1e293b", fontSize: "14px", minWidth: "150px" }}
                        >
                            {patients.length === 0 && <option value="">No patients found</option>}
                            {patients.map(p => (
                                <option key={p._id} value={p._id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="reports-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                        <div className="chart-card ring-chart-card">
                            <h3>Adherence Score</h3>
                            <div className="ring-chart-container">
                                <svg width="140" height="140" viewBox="0 0 100 100" className="circular-progress">
                                    <circle className="bg-ring" cx="50" cy="50" r="40" fill="none" stroke="var(--primary-100)" strokeWidth="12" />
                                    <circle className="progress-ring" cx="50" cy="50" r="40" fill="none" stroke="var(--primary)" strokeWidth="12" strokeDasharray="251.2" strokeDashoffset={ringOffset} strokeLinecap="round" transform="rotate(-90 50 50)" style={{ transition: "stroke-dashoffset 0.5s ease" }} />
                                </svg>
                                <div className="ring-value">
                                    <h2>{adherenceScore}%</h2>
                                </div>
                            </div>
                        </div>

                        <div className="chart-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px' }}>
                            <h3 style={{ margin: 0, fontSize: '15px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Programs Enrolled</h3>
                            <div style={{ fontSize: '48px', fontWeight: '800', color: 'var(--primary-400)', marginTop: '10px' }}>{enrolledProgramsCount}</div>
                        </div>

                        <div className="export-card" style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                            <div className="card-header-icon">
                                <h3>Export Detailed Report</h3>
                            </div>
                            <p style={{ marginTop: '10px', marginBottom: '20px' }}>Download a full PDF summary for clinical records or insurance providers.</p>
                            <button className="export-btn" onClick={() => window.print()} style={{ marginTop: 'auto' }}>Download Clinical PDF</button>
                        </div>
                    </div>

                    <div style={{ marginTop: '40px' }}>
                        <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#1e293b', marginBottom: '20px' }}>Session History</h3>
                        
                        {completedAppointmentsForPatient.length === 0 ? (
                            <div style={{ background: '#f8fafc', padding: '30px', borderRadius: '12px', textAlign: 'center', color: '#64748b' }}>
                                No completed sessions for this patient yet.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {completedAppointmentsForPatient.map(app => (
                                    <div key={app._id} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
                                            <div>
                                                <h4 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>Session {app.sessionNumber || '?'}</h4>
                                                <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#64748b', fontWeight: '500' }}>{new Date(app.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })} — Home Visit</p>
                                            </div>
                                            {app.patientRating && (
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                    <div style={{ background: '#fef3c7', color: '#d97706', padding: '4px 12px', borderRadius: '16px', fontSize: '14px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <span>★</span> {app.patientRating} / 5
                                                    </div>
                                                    {app.patientFeeling && (
                                                        <span style={{ fontSize: '13px', color: '#64748b', marginTop: '6px', fontWeight: '600' }}>Feeling: <span style={{ color: app.patientFeeling === 'Better' ? '#16a34a' : app.patientFeeling === 'Worse' ? '#dc2626' : '#475569' }}>{app.patientFeeling}</span></span>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                            <div>
                                                <h5 style={{ fontSize: '13px', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em', marginBottom: '8px' }}>Doctor's Clinical Note</h5>
                                                {app.problemDescription && (
                                                    <div style={{ marginBottom: '12px' }}>
                                                        <strong style={{ display: 'block', fontSize: '14px', color: '#334155' }}>Problem:</strong>
                                                        <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#475569' }}>{app.problemDescription}</p>
                                                    </div>
                                                )}
                                                {app.medicine && (
                                                    <div style={{ marginBottom: '12px' }}>
                                                        <strong style={{ display: 'block', fontSize: '14px', color: '#334155' }}>Medicine:</strong>
                                                        <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#475569' }}>{app.medicine}</p>
                                                    </div>
                                                )}
                                                {app.suggestion && (
                                                    <div style={{ marginBottom: '12px' }}>
                                                        <strong style={{ display: 'block', fontSize: '14px', color: '#334155' }}>Suggestion:</strong>
                                                        <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#475569' }}>{app.suggestion}</p>
                                                    </div>
                                                )}
                                                {app.followUpNeeded && (
                                                    <div style={{ marginTop: '16px', background: 'var(--primary-50)', padding: '10px 16px', borderRadius: '8px', display: 'inline-block' }}>
                                                        <strong style={{ fontSize: '13px', color: 'var(--primary-hover)' }}>Next Session Scheduled:</strong>
                                                        <span style={{ marginLeft: '8px', fontSize: '14px', fontWeight: '600', color: 'var(--primary-900)' }}>{new Date(app.followUpDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '24px' }}>
                                                <h5 style={{ fontSize: '13px', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.05em', marginBottom: '8px' }}>Patient Feedback</h5>
                                                {app.patientReview ? (
                                                    <p style={{ margin: 0, fontSize: '14px', color: '#475569', fontStyle: 'italic', lineHeight: '1.6' }}>"{app.patientReview}"</p>
                                                ) : (
                                                    <p style={{ margin: 0, fontSize: '14px', color: '#cbd5e1' }}>Patient has not submitted a review for this session yet.</p>
                                                )}
                                            </div>
                                        </div>

                                        {app.programCode && (
                                            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px dashed #cbd5e1', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '13px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Program Linked:</span>
                                                <span style={{ fontSize: '14px', color: '#0f172a', fontWeight: '500', background: '#f1f5f9', padding: '4px 10px', borderRadius: '6px' }}>
                                                    {app.programCode} — {app.programTitle || "Program"}
                                                </span>
                                            </div>
                                        )}

                                        {/* Send to Patient action row */}
                                        <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px' }}>
                                            {sentStatuses[app._id] ? (
                                                <span style={{ fontSize: '13px', fontWeight: '600', color: '#16a34a', background: '#dcfce7', padding: '6px 14px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                                    Report Sent to Patient
                                                </span>
                                            ) : (
                                                <button
                                                    onClick={() => openSendConfirm(app)}
                                                    style={{ fontSize: '13px', fontWeight: '600', color: 'var(--primary)', background: 'var(--primary-50)', border: '1px solid var(--primary-200)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.15s' }}
                                                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--primary-100)'; }}
                                                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--primary-50)'; }}
                                                >
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                                                    Send to Patient
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                </div>
                
                {/* -------------------------------------------------------------------------------- */}
                {/* PRINT ONLY LAYOUT TEMPLATE                                                       */}
                {/* -------------------------------------------------------------------------------- */}
                <div className="print-layout">
                    {/* Header */}
                    <div className="print-header">
                        <div className="print-header-left">
                            <h1>PhysioCare</h1>
                            <p>Rehabilitation &amp; Clinical Physiotherapy</p>
                        </div>
                        <div className="print-header-right">
                            <p>Clinical Report</p>
                            <h3>RPT-2026-{Math.floor(Math.random() * 1000).toString().padStart(4, '0')}</h3>
                        </div>
                    </div>
                    <div className="print-header" style={{ paddingTop: 0, paddingBottom: '20px' }}>
                        <div className="print-header-meta" style={{ width: '100%' }}>
                            <div className="print-meta-block">
                                <p style={{ fontSize: '11px', color: 'var(--primary-300)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, margin: '0 0 4px 0' }}>Report Generated</p>
                                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: 'white' }}>{reportGeneratedDate} — Dr. {doctorName}</h3>
                            </div>
                            <div className="print-meta-block" style={{ textAlign: 'right' }}>
                                <p style={{ fontSize: '11px', color: 'var(--primary-300)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, margin: '0 0 4px 0' }}>Treatment Period</p>
                                <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: 'white' }}>{treatmentPeriod}</h3>
                            </div>
                        </div>
                    </div>

                    {/* Patient Info Row */}
                    <div className="print-patient-info">
                        <div className="print-info-item">
                            <label>Patient Name</label>
                            <span>{patientName}</span>
                        </div>
                        <div className="print-info-item">
                            <label>Patient ID</label>
                            <span>{displayPatientId}</span>
                        </div>
                        <div className="print-info-item">
                            <label>Condition</label>
                            <span>{latestProblem}</span>
                        </div>
                        <div className="print-info-item">
                            <label>Physiotherapist</label>
                            <span>Dr. {doctorName}</span>
                        </div>
                    </div>

                    <div className="print-body">
                        {/* Treatment Summary */}
                        <div className="print-section-title">Treatment Summary</div>
                        <div className="print-metrics-row">
                            <div className="print-metric-card m-blue">
                                <h2>{totalSessions}</h2>
                                <p>Total sessions</p>
                            </div>
                            <div className="print-metric-card m-green">
                                <h2>{completedCount}</h2>
                                <p>Completed</p>
                            </div>
                            <div className="print-metric-card m-orange">
                                <h2>{upcomingCount}</h2>
                                <p>Upcoming</p>
                            </div>
                            <div className="print-metric-card">
                                <h2>{avgRating > 0 ? avgRating : "-"}</h2>
                                <p>Avg rating</p>
                            </div>
                        </div>

                        {/* Adherence & Program */}
                        <div className="print-section-title">Adherence & Program Progress</div>
                        <div className="print-adherence-row">
                            <div className="print-adherence-left">
                                <div style={{ position: 'relative', width: '90px', height: '90px' }}>
                                    <svg width="90" height="90" viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)' }}>
                                        <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="14" />
                                        <circle cx="50" cy="50" r="40" fill="none" stroke="var(--primary-900)" strokeWidth="14" strokeDasharray="251.2" strokeDashoffset={ringOffset} strokeLinecap="round" />
                                    </svg>
                                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: '800', color: '#0f172a' }}>
                                        {adherenceScore}%
                                    </div>
                                </div>
                                <div>
                                    <h4 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '700', color: 'var(--primary-900)' }}>{adherenceScore}% adherence</h4>
                                    <p style={{ margin: '0 0 4px 0', fontSize: '13px', color: '#64748b' }}>{completedCount} of {totalSessions} sessions completed</p>
                                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Avg pain level: <span style={{ fontWeight: '600', color: '#0f172a' }}>4.5 / 10</span></p>
                                </div>
                            </div>
                            <div className="print-adherence-right">
                                {enrolledProgramsCount > 0 ? (
                                    <>
                                        <div className="print-prog-item">
                                            <span style={{ width: '150px' }}>Neck rehab program</span>
                                            <div className="print-prog-bar-bg"><div className="print-prog-bar-fill" style={{ width: '70%' }}></div></div>
                                            <span style={{ color: '#64748b', fontWeight: '600', width: '30px', textAlign: 'right' }}>70%</span>
                                        </div>
                                        {enrolledProgramsCount > 1 && (
                                            <div className="print-prog-item">
                                                <span style={{ width: '150px' }}>Head mobility exercises</span>
                                                <div className="print-prog-bar-bg"><div className="print-prog-bar-fill" style={{ width: '50%' }}></div></div>
                                                <span style={{ color: '#64748b', fontWeight: '600', width: '30px', textAlign: 'right' }}>50%</span>
                                            </div>
                                        )}
                                        {enrolledProgramsCount > 2 && (
                                            <div className="print-prog-item">
                                                <span style={{ width: '150px' }}>Posture correction</span>
                                                <div className="print-prog-bar-bg"><div className="print-prog-bar-fill" style={{ width: '30%', background: '#94a3b8 !important' }}></div></div>
                                                <span style={{ color: '#64748b', fontWeight: '600', width: '30px', textAlign: 'right' }}>30%</span>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <p style={{ fontSize: '13px', color: '#94a3b8', fontStyle: 'italic', margin: 0 }}>No programs enrolled currently.</p>
                                )}
                            </div>
                        </div>

                        {/* Session History */}
                        <div className="print-section-title">Session History</div>
                        <div className="print-sessions-list">
                            {patientApps.map((app, index) => {
                                const isCompleted = app.status === "Completed";
                                const isUpcoming = app.status === "Pending" || app.status === "Confirmed";
                                const sessionNumberText = app.sessionNumber ? `Session ${app.sessionNumber}` : `Session ${patientApps.length - index}`;
                                
                                return (
                                    <div key={app._id} className={`print-session-card ${isUpcoming ? 'upcoming' : ''}`}>
                                        <div className="print-session-header">
                                            <div className="print-session-header-left">
                                                <h4>{sessionNumberText}</h4>
                                                <p>{new Date(app.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })} — Home Visit</p>
                                            </div>
                                            <div className="print-session-header-right" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                {isCompleted ? (
                                                    <>
                                                        <span className="print-session-badge completed">Completed</span>
                                                        {app.patientRating && (
                                                            <div style={{ color: '#d97706', fontSize: '14px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                <span style={{ display: 'flex', gap: '2px' }}>
                                                                    {[...Array(5)].map((_, i) => (
                                                                        <span key={i} style={{ color: i < app.patientRating ? '#f59e0b' : '#e5e7eb' }}>★</span>
                                                                    ))}
                                                                </span>
                                                                <span style={{ marginLeft: '8px', color: '#64748b' }}>{app.patientRating} / 5</span>
                                                            </div>
                                                        )}
                                                    </>
                                                ) : (
                                                    <span className="print-session-badge upcoming">Upcoming</span>
                                                )}
                                            </div>
                                        </div>

                                        {isCompleted && (
                                            <div className="print-session-body">
                                                <div>
                                                    <div className="print-col-title">Doctor's Clinical Note</div>
                                                    
                                                    {app.problemDescription && (
                                                        <div style={{ marginBottom: '16px' }}>
                                                            <p className="print-note-label">Problem</p>
                                                            <p className="print-note-value">{app.problemDescription}</p>
                                                        </div>
                                                    )}
                                                    
                                                    {app.medicine ? (
                                                        <div style={{ marginBottom: '16px' }}>
                                                            <p className="print-note-label">Medicine prescribed</p>
                                                            <p className="print-note-value">{app.medicine}</p>
                                                        </div>
                                                    ) : (
                                                        <div style={{ marginBottom: '16px' }}>
                                                            <p className="print-note-label">Medicine prescribed</p>
                                                            <p className="print-note-value" style={{ color: '#94a3b8 !important', fontStyle: 'italic' }}>None prescribed</p>
                                                        </div>
                                                    )}
                                                    
                                                    {app.suggestion && (
                                                        <div style={{ marginBottom: '16px' }}>
                                                            <p className="print-note-label">Suggestion</p>
                                                            <p className="print-note-value">{app.suggestion}</p>
                                                        </div>
                                                    )}
                                                    
                                                    {app.followUpNeeded && (
                                                        <div style={{ marginTop: '20px' }}>
                                                            <h5 className="print-follow-up">Follow-up</h5>
                                                            <span className="print-follow-up-badge">
                                                                Next session: {new Date(app.followUpDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div>
                                                    <div className="print-col-title">Patient Feedback</div>
                                                    
                                                    {app.patientReview ? (
                                                        <>
                                                            <p className="print-note-label">Review</p>
                                                            <p className="print-feedback-review">"{app.patientReview}"</p>
                                                            
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                                <div>
                                                                    <p className="print-note-label">Pain level reported</p>
                                                                    <span className="print-pain-badge">5 / 10</span>
                                                                </div>
                                                                
                                                                {app.patientFeeling && (
                                                                    <div>
                                                                        <p className="print-note-label">Feeling compared to last session</p>
                                                                        <span className="print-feeling-badge">{app.patientFeeling}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <p style={{ fontSize: '13px', color: '#94a3b8', fontStyle: 'italic', margin: 0 }}>No review provided.</p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                        {isCompleted && app.programCode && (
                                            <div style={{ borderTop: '1px dashed #e2e8f0', padding: '16px 24px', background: '#f8fafc', borderRadius: '0 0 12px 12px' }}>
                                                <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '1px', marginRight: '12px' }}>Program Linked</span>
                                                <span style={{ fontSize: '13px', color: '#0f172a', fontWeight: '600' }}>{app.programCode} — {app.programTitle || "Program"}</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <div className="print-footer">
                        <div className="print-footer-left">
                            <p style={{ color: 'var(--primary) !important', marginBottom: '2px' }}>Generated by Physionet — physionet.app</p>
                            <p>This report is confidential and intended for clinical use only.</p>
                        </div>
                        <div className="print-footer-right">
                            <h4>Dr. {doctorName}</h4>
                            <p>Certified Physiotherapist</p>
                        </div>
                    </div>
                </div>
                {/* -------------------------------------------------------------------------------- */}

            </div>

            {/* ─── SEND CONFIRMATION MODAL ─── */}
            {sendConfirmModal && (
                <div
                    style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(4px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
                    onClick={(e) => { if (e.target === e.currentTarget) setSendConfirmModal(null); }}
                >
                    <div style={{ background: 'white', borderRadius: '20px', width: '100%', maxWidth: '460px', boxShadow: '0 25px 60px rgba(0,0,0,0.25)', overflow: 'hidden', animation: 'slideUp 0.2s ease' }}>

                        {/* Modal Header */}
                        <div style={{ background: 'linear-gradient(135deg, var(--primary-hover) 0%, var(--primary) 100%)', padding: '24px 28px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '4px' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                                </div>
                                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'white' }}>Send Report to Patient</h3>
                            </div>
                            <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.75)' }}>The patient will see this session report in their "My Reports" section.</p>
                        </div>

                        {/* Session Preview */}
                        <div style={{ padding: '24px 28px' }}>
                            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px 20px', marginBottom: '20px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                    <div>
                                        <p style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#0f172a' }}>Session {sendConfirmModal.sessionNumber || '—'}</p>
                                        <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#64748b' }}>
                                            {new Date(sendConfirmModal.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })}
                                        </p>
                                    </div>
                                    {sendConfirmModal.patientRating && (
                                        <span style={{ background: '#fef3c7', color: '#d97706', padding: '4px 10px', borderRadius: '20px', fontSize: '13px', fontWeight: '700' }}>
                                            ★ {sendConfirmModal.patientRating}/5
                                        </span>
                                    )}
                                </div>
                                {sendConfirmModal.problemDescription && (
                                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '10px' }}>
                                        <p style={{ margin: 0, fontSize: '12px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Problem</p>
                                        <p style={{ margin: 0, fontSize: '13px', color: '#334155', fontWeight: '500', lineHeight: '1.5' }}>{sendConfirmModal.problemDescription}</p>
                                    </div>
                                )}
                            </div>

                            <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#64748b', lineHeight: '1.6' }}>
                                This will share the clinical note (problem, medicine, suggestion, next session date) with <strong style={{ color: '#0f172a' }}>{patients.find(p => p._id === selectedPatientId)?.name || 'the patient'}</strong>. Are you sure?
                            </p>

                            {/* Action Buttons */}
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button
                                    onClick={() => setSendConfirmModal(null)}
                                    disabled={sending}
                                    style={{ flex: 1, padding: '11px', borderRadius: '10px', border: '1px solid #e2e8f0', background: 'white', color: '#475569', fontWeight: '600', fontSize: '14px', cursor: 'pointer' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSendToPatient}
                                    disabled={sending}
                                    style={{ flex: 2, padding: '11px', borderRadius: '10px', border: 'none', background: sending ? 'var(--primary-300)' : 'var(--primary)', color: 'white', fontWeight: '700', fontSize: '14px', cursor: sending ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'background 0.15s' }}
                                >
                                    {sending ? (
                                        <>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>
                                            Sending...
                                        </>
                                    ) : (
                                        <>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                                            Yes, Send Report
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default DoctorReports;
