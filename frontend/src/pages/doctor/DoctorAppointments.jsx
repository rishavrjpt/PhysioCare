import { useState, useEffect } from "react";
import { decodeToken } from "../../utils/auth";
import { useLocation } from "react-router-dom";
import DoctorSidebar from "../../components/DoctorSidebar";
import EmptyState from "../../components/EmptyState";
import "../../style/doctor/doctorAppointments.css";
import { API_BASE_URL } from "../../config";

function DoctorAppointments() {
    const location = useLocation();
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState("Pending");

    // Modal state
    const [completingAppId, setCompletingAppId] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [noteForm, setNoteForm] = useState({
        problemDescription: "",
        medicine: "",
        suggestion: "",
        followUpNeeded: false,
        followUpDate: "",
        programCode: "",
        programTitle: ""
    });
    const [calculatedSessionNumber, setCalculatedSessionNumber] = useState(1);

    // Program picker state
    const [doctorPrograms, setDoctorPrograms] = useState([]);
    const [programSearch, setProgramSearch] = useState("");
    const [showProgramDrop, setShowProgramDrop] = useState(false);
    const [selectedProgram, setSelectedProgram] = useState(null);

    const fetchAppointments = async () => {
        const token = localStorage.getItem("doctorToken");
        let doctorId = null;
        if (token) {
            const payload = decodeToken(token);
            doctorId = payload.id;
        }

        if (!doctorId) {
            setLoading(false);
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/appointments/doctor/${doctorId}`);
            const data = await response.json();
            setAppointments(data);
        } catch (error) {
            console.error("Error fetching doctor appointments:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setLoading(true);
        fetchAppointments();
    }, [location]);

    const [pendingActionIds, setPendingActionIds] = useState(new Set());

    const handleUpdateStatus = async (id, newStatus) => {
        if (pendingActionIds.has(id)) return;

        const prev = appointments;
        setAppointments(prev => prev.map(a => a._id === id ? { ...a, status: newStatus } : a));
        setPendingActionIds(p => new Set(p).add(id));

        try {
            const response = await fetch(`${API_BASE_URL}/appointments/${id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus })
            });
            if (!response.ok) {
                setAppointments(prev);
                alert("Failed to update appointment status. Please try again.");
            }
        } catch (error) {
            console.error("Error updating status:", error);
            setAppointments(prev);
            alert("Network error updating status.");
        } finally {
            setPendingActionIds(p => {
                const next = new Set(p);
                next.delete(id);
                return next;
            });
        }
    };

    const openCompleteModal = async (appointment) => {
        setCompletingAppId(appointment._id);
        const pastCompleted = appointments.filter(a => a.patientId?._id === appointment.patientId?._id && a.status === "Completed").length;
        setCalculatedSessionNumber(pastCompleted + 1);
        setNoteForm({ problemDescription: "", medicine: "", suggestion: "", followUpNeeded: false, followUpDate: "", programCode: "", programTitle: "" });
        setSelectedProgram(null);
        setProgramSearch("");
        setShowProgramDrop(false);

        // Fetch this doctor's programs for the picker
        const token = localStorage.getItem("doctorToken");
        if (token) {
            const payload = decodeToken(token);
            try {
                const res = await fetch(`${API_BASE_URL}/programs/doctor/${payload.id}`);
                const data = await res.json();
                setDoctorPrograms(Array.isArray(data) ? data : []);
            } catch (e) {
                console.error("Error fetching programs for picker:", e);
            }
        }
    };

    const handleCompleteSubmit = async () => {
        setIsSubmitting(true);
        try {
            const response = await fetch(`${API_BASE_URL}/appointments/${completingAppId}/complete`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(noteForm)
            });
            if (response.ok) {
                setCompletingAppId(null);
                fetchAppointments();
            } else {
                alert("Failed to mark as complete");
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const displayAppointments = appointments.filter(a => a.status === activeTab);
    const upcomingAppointments = appointments.filter(a => a.status === "Confirmed");

    return (
        <div className="appointments-page">
            <DoctorSidebar />

            <div className="main">
                <div className="content">

                    <div className="topbar">
                        <div className="breadcrumb" style={{ visibility: 'hidden' }}></div>
                        <div className="topbar-actions">
                            <div className="top-right">
                                <div className="icon-btn notification">
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                                    <span className="badge">1</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="page-header">
                        <h2>Appointments</h2>
                        <p>Manage and track your patient sessions.</p>
                    </div>

                    <div className="appointments-container">

                        <div className="appointments-left">

                            <div className="appointments-tabs">
                                <h3>All Appointments</h3>
                                <div className="tabs-wrapper">
                                    <div
                                        className={`tab-pill pending ${activeTab === 'Pending' ? 'active' : ''}`}
                                        onClick={() => setActiveTab('Pending')}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" strokeWidth="0"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
                                        Pending
                                    </div>
                                    <div
                                        className={`tab-pill confirmed ${activeTab === 'Confirmed' ? 'active' : ''}`}
                                        onClick={() => setActiveTab('Confirmed')}
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                        Confirmed
                                    </div>
                                    <div
                                        className={`tab-pill ${activeTab === 'Completed' ? 'active' : ''}`}
                                        onClick={() => setActiveTab('Completed')}
                                        style={{ padding: '6px 16px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
                                    >
                                        Completed
                                    </div>
                                    <div
                                        className={`tab-pill ${activeTab === 'Cancelled' ? 'active' : ''}`}
                                        onClick={() => setActiveTab('Cancelled')}
                                        style={{ padding: '6px 16px', borderRadius: '20px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
                                    >
                                        Cancelled
                                    </div>
                                </div>
                            </div>

                            <div className="cards-grid">
                                {loading && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', gridColumn: '1 / -1' }}>
                                        {[1, 2, 3].map(n => (
                                            <div key={n} className="skeleton" style={{ height: '120px', borderRadius: '16px' }} />
                                        ))}
                                    </div>
                                )}
                                {!loading && displayAppointments.length === 0 && (
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <EmptyState icon="calendar" title={`No ${activeTab.toLowerCase()} appointments`} message={`You have no appointments currently marked as ${activeTab.toLowerCase()}.`} />
                                    </div>
                                )}
                                {!loading && displayAppointments.map(app => (
                                    <div className="appointment-card-large" key={app._id} style={{ height: 'auto', display: 'block' }}>
                                        <div className="card-top" style={{ marginBottom: '16px' }}>
                                            <div className="patient-user">
                                                <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(app.patientId?.name || "Patient")}&background=random`} alt={app.patientId?.name} className="patient-avatar-large" />
                                                <div className="patient-info">
                                                    <h4>{app.patientId?.name || "Unknown"}</h4>
                                                    <p className="treatment">{app.date} • {app.time}</p>
                                                    {app.notes && <p className="activity">Notes: {app.notes}</p>}
                                                </div>
                                            </div>
                                            <div className={`badge-status ${app.status === 'Pending' ? 'badge-status-pending' : app.status === 'Confirmed' ? 'badge-status-confirmed' : app.status === 'Completed' ? 'badge-status-completed' : 'badge-status-cancelled'}`}>
                                                {app.status}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            {app.status === 'Pending' && (
                                                <button
                                                    className="view-details-btn"
                                                    style={{ background: '#10b981', color: 'white', border: 'none', opacity: pendingActionIds.has(app._id) ? 0.6 : 1, cursor: pendingActionIds.has(app._id) ? 'not-allowed' : 'pointer' }}
                                                    onClick={() => handleUpdateStatus(app._id, 'Confirmed')}
                                                    disabled={pendingActionIds.has(app._id)}
                                                >
                                                    {pendingActionIds.has(app._id) ? "Updating..." : "Confirm"}
                                                </button>
                                            )}
                                            {app.status === 'Confirmed' && (
                                                <button className="view-details-btn" style={{ background: 'var(--primary)', color: 'white', border: 'none' }} onClick={() => openCompleteModal(app)}>Complete</button>
                                            )}
                                            {(app.status === 'Pending' || app.status === 'Confirmed') && (
                                                <button
                                                    className="view-details-btn"
                                                    style={{ background: '#ef4444', color: 'white', border: 'none', opacity: pendingActionIds.has(app._id) ? 0.6 : 1, cursor: pendingActionIds.has(app._id) ? 'not-allowed' : 'pointer' }}
                                                    onClick={() => handleUpdateStatus(app._id, 'Cancelled')}
                                                    disabled={pendingActionIds.has(app._id)}
                                                >
                                                    {pendingActionIds.has(app._id) ? "Updating..." : "Cancel"}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                        </div>

                        <div className="appointments-right">
                            <div className="upcoming-appointments-box">
                                <div className="section-header">
                                    <h3>Upcoming Appointments</h3>
                                </div>

                                <div className="divider-line full-width"></div>

                                <div className="appointment-list">
                                    {upcomingAppointments.length === 0 && <p style={{ color: '#64748b', fontSize: '14px' }}>No upcoming confirmed appointments.</p>}
                                    {upcomingAppointments.map((app, index) => (
                                        <div key={app._id}>
                                            <div className="appointment-item">
                                                <div className="appointment-user">
                                                    <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(app.patientId?.name || "Patient")}&background=random`} alt={app.patientId?.name} className="patient-avatar" />
                                                    <div className="appointment-item-info">
                                                        <h4>{app.patientId?.name || "Unknown"}</h4>
                                                        <p className="time">{app.date} • {app.time}</p>
                                                        <div className="tags">
                                                            <span className="tag blue-tag">Confirmed</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                            {index < upcomingAppointments.length - 1 && <div className="divider-line full-width"></div>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                    </div>

                </div>
            </div>

            {completingAppId && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
                    <div style={{ background: 'white', borderRadius: '16px', padding: '32px', width: '90%', maxWidth: '500px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#111827' }}>Complete Session</h3>
                                <span style={{ display: 'inline-block', background: 'var(--primary-50)', color: 'var(--primary)', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600', marginTop: '6px' }}>
                                    Session {calculatedSessionNumber}
                                </span>
                            </div>
                            <button onClick={() => setCompletingAppId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Problem Description</label>
                                <textarea 
                                    value={noteForm.problemDescription}
                                    onChange={e => setNoteForm({...noteForm, problemDescription: e.target.value})}
                                    placeholder="Patient's condition today..."
                                    style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '12px', minHeight: '60px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none', transition: 'all 0.2s', fontSize: '15px' }}
                                    onFocus={(e) => { e.target.style.borderColor = 'var(--primary-500)'; e.target.style.boxShadow = '0 0 0 3px rgba(13, 148, 136, 0.1)'; }}
                                    onBlur={(e) => { e.target.style.borderColor = '#cbd5e1'; e.target.style.boxShadow = 'none'; }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Medicine (Optional)</label>
                                <input 
                                    type="text" 
                                    value={noteForm.medicine}
                                    onChange={e => setNoteForm({...noteForm, medicine: e.target.value})}
                                    placeholder="e.g. Ibuprofen 400mg"
                                    style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '12px', boxSizing: 'border-box', outline: 'none', transition: 'all 0.2s', fontSize: '15px' }}
                                    onFocus={(e) => { e.target.style.borderColor = 'var(--primary-500)'; e.target.style.boxShadow = '0 0 0 3px rgba(13, 148, 136, 0.1)'; }}
                                    onBlur={(e) => { e.target.style.borderColor = '#cbd5e1'; e.target.style.boxShadow = 'none'; }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Doctor's Suggestion</label>
                                <textarea 
                                    value={noteForm.suggestion}
                                    onChange={e => setNoteForm({...noteForm, suggestion: e.target.value})}
                                    placeholder="Exercises or lifestyle changes..."
                                    style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '12px', minHeight: '60px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none', transition: 'all 0.2s', fontSize: '15px' }}
                                    onFocus={(e) => { e.target.style.borderColor = 'var(--primary-500)'; e.target.style.boxShadow = '0 0 0 3px rgba(13, 148, 136, 0.1)'; }}
                                    onBlur={(e) => { e.target.style.borderColor = '#cbd5e1'; e.target.style.boxShadow = 'none'; }}
                                />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <input 
                                    type="checkbox" 
                                    id="followUp"
                                    checked={noteForm.followUpNeeded}
                                    onChange={e => setNoteForm({...noteForm, followUpNeeded: e.target.checked})}
                                />
                                <label htmlFor="followUp" style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>Follow-up Needed?</label>
                            </div>
                            {noteForm.followUpNeeded && (
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Next Session Date</label>
                                    <input 
                                        type="date" 
                                        value={noteForm.followUpDate}
                                        onChange={e => setNoteForm({...noteForm, followUpDate: e.target.value})}
                                        style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '8px', boxSizing: 'border-box' }}
                                    />
                                </div>
                            )}

                            <div style={{ position: 'relative' }}>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>
                                    Link a Program <span style={{ fontWeight: '400', color: '#9ca3af' }}>(Optional)</span>
                                </label>

                                {selectedProgram ? (
                                    // Selected pill — shows program name + code
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'var(--primary-50)', border: '1px solid var(--primary-200)', borderRadius: '12px' }}>
                                        <div style={{ flex: 1 }}>
                                            <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--primary-hover)' }}>{selectedProgram.title}</span>
                                            <span style={{ marginLeft: '10px', fontSize: '12px', fontWeight: '700', background: 'var(--primary-100)', color: 'var(--primary)', padding: '2px 8px', borderRadius: '6px', letterSpacing: '0.05em' }}>{selectedProgram.programCode}</span>
                                        </div>
                                        <button
                                            onClick={() => { setSelectedProgram(null); setProgramSearch(""); setNoteForm(f => ({ ...f, programCode: "", programTitle: "" })); }}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: '2px', display: 'flex' }}
                                        >
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                        </button>
                                    </div>
                                ) : (
                                    // Search input
                                    <div style={{ position: 'relative' }}>
                                        <input
                                            type="text"
                                            value={programSearch}
                                            onChange={e => { setProgramSearch(e.target.value); setShowProgramDrop(true); }}
                                            onFocus={() => setShowProgramDrop(true)}
                                            placeholder="Type program name to search..."
                                            style={{ width: '100%', padding: '11px 14px', border: '1px solid #cbd5e1', borderRadius: '12px', boxSizing: 'border-box', outline: 'none', fontSize: '14px', transition: 'all 0.2s' }}
                                            onFocus2={(e) => { e.target.style.borderColor = 'var(--primary-500)'; e.target.style.boxShadow = '0 0 0 3px rgba(13, 148, 136,0.1)'; }}
                                            onBlur={() => setTimeout(() => setShowProgramDrop(false), 150)}
                                        />
                                        {showProgramDrop && doctorPrograms.length > 0 && (
                                            <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.1)', zIndex: 50, overflow: 'hidden', maxHeight: '200px', overflowY: 'auto' }}>
                                                {doctorPrograms
                                                    .filter(p => p.title.toLowerCase().includes(programSearch.toLowerCase()) || p.programCode.toLowerCase().includes(programSearch.toLowerCase()))
                                                    .map(prog => (
                                                        <div
                                                            key={prog._id}
                                                            onMouseDown={() => {
                                                                setSelectedProgram(prog);
                                                                setNoteForm(f => ({ ...f, programCode: prog.programCode, programTitle: prog.title }));
                                                                setProgramSearch("");
                                                                setShowProgramDrop(false);
                                                            }}
                                                            style={{ padding: '12px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', transition: 'background 0.1s' }}
                                                            onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                                                            onMouseLeave={e => e.currentTarget.style.background = 'white'}
                                                        >
                                                            <div>
                                                                <p style={{ margin: 0, fontSize: '14px', fontWeight: '600', color: '#0f172a' }}>{prog.title}</p>
                                                                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>{prog.specialty}</p>
                                                            </div>
                                                            <span style={{ fontSize: '12px', fontWeight: '700', background: 'var(--primary-50)', color: 'var(--primary)', padding: '3px 9px', borderRadius: '8px', letterSpacing: '0.05em', flexShrink: 0 }}>{prog.programCode}</span>
                                                        </div>
                                                    ))
                                                }
                                                {doctorPrograms.filter(p => p.title.toLowerCase().includes(programSearch.toLowerCase()) || p.programCode.toLowerCase().includes(programSearch.toLowerCase())).length === 0 && (
                                                    <div style={{ padding: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>No programs match</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                                <span style={{ display: 'block', fontSize: '11px', color: '#9ca3af', marginTop: '5px' }}>Selecting a program links this session and auto-fills the code in the patient's report.</span>
                            </div>

                            <button 
                                onClick={handleCompleteSubmit}
                                disabled={isSubmitting}
                                style={{ width: '100%', padding: '12px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', marginTop: '10px', cursor: isSubmitting ? 'not-allowed' : 'pointer', boxSizing: 'border-box' }}
                            >
                                {isSubmitting ? "Saving..." : "Mark Complete & Save"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default DoctorAppointments;
