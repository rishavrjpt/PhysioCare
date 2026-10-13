import { useState, useEffect, useCallback } from "react";
import { decodeToken } from "../utils/auth";
import { useLocation } from "react-router-dom";
import Layout from "../components/Layout";
import DoctorProfileModal from "../components/DoctorProfileModal";
import "../style/appointmentsPage.css";
import { API_BASE_URL } from "../config";
import { cachedFetch, invalidate } from "../utils/dataStore";
import { CardSkeleton } from "../components/Skeleton";
import EmptyState from "../components/EmptyState";

import doc1 from "../assets/ex1.jpg";
import physio from "../assets/patient.jpg";

const getStatusBadgeClass = (status) => {
  switch (status) {
    case "Pending": return "badge-status badge-status-pending";
    case "Confirmed": return "badge-status badge-status-confirmed";
    case "Completed": return "badge-status badge-status-completed";
    case "Cancelled": return "badge-status badge-status-cancelled";
    case "Rescheduled": return "badge-status badge-status-rescheduled";
    default: return "badge-status";
  }
};

function AppointmentsPage() {
  const location = useLocation();
  const [tab, setTab] = useState("upcoming");
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Review Modal state
  const [reviewAppId, setReviewAppId] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    patientFeeling: "Same",
    patientRating: 5,
    patientReview: ""
  });

  const [doctors, setDoctors] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [patientCity, setPatientCity] = useState("");
  const [pendingActionIds, setPendingActionIds] = useState(new Set());

  const loadDoctorsList = useCallback(async (cityToUse = "", forceFresh = false) => {
    if (forceFresh) invalidate("doctors:");
    const docKey = `doctors:${cityToUse || "all"}`;
    const url = `${API_BASE_URL}/doctors${cityToUse ? `?city=${encodeURIComponent(cityToUse)}` : ""}`;
    try {
      const data = await cachedFetch(docKey, url, { ttl: 30000 });
      setDoctors(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Error fetching doctors:", e);
    } finally {
      setLoadingDoctors(false);
    }
  }, []);

  const fetchAppointments = useCallback(async (forceFreshDoctors = false) => {
    const token = localStorage.getItem("patientToken");
    let patientId = null;
    if (token) {
      const payload = decodeToken(token);
      patientId = payload.id;
    }

    if (!patientId) {
      setLoading(false);
      setLoadingDoctors(false);
      return;
    }

    // Parallel fetch: patient details, appointments, and doctors
    cachedFetch(`user:${patientId}`, `${API_BASE_URL}/auth/${patientId}`, { ttl: 30000 })
      .then(userData => {
        const city = userData?.city || "";
        if (city) setPatientCity(city);
        loadDoctorsList(city, forceFreshDoctors);
      })
      .catch(() => loadDoctorsList("", forceFreshDoctors));

    fetch(`${API_BASE_URL}/appointments/patient/${patientId}`)
      .then(res => res.ok ? res.json() : [])
      .then(apptData => {
        setAppointments(Array.isArray(apptData) ? apptData : []);
      })
      .catch(error => console.error("Error fetching appointments:", error))
      .finally(() => setLoading(false));
  }, [loadDoctorsList]);

  useEffect(() => {
    setLoading(true);
    setLoadingDoctors(true);
    fetchAppointments();

    const handleProfileUpdate = () => {
      fetchAppointments(true);
    };
    window.addEventListener("physiocare:profile-updated", handleProfileUpdate);

    const onFocus = () => {
      fetchAppointments(true);
    };
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("physiocare:profile-updated", handleProfileUpdate);
      window.removeEventListener("focus", onFocus);
    };
  }, [fetchAppointments, location]);

  const handleUpdateStatus = async (appointmentId, newStatus) => {
    if (pendingActionIds.has(appointmentId)) return;

    const prev = appointments;
    setAppointments(prev => prev.map(a => a._id === appointmentId ? { ...a, status: newStatus } : a));
    setPendingActionIds(p => new Set(p).add(appointmentId));

    try {
      const response = await fetch(`${API_BASE_URL}/appointments/${appointmentId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (!response.ok) {
        setAppointments(prev);
        alert("Failed to update appointment. Please try again.");
      }
    } catch (error) {
      console.error("Error updating appointment status:", error);
      setAppointments(prev);
      alert("Network error updating appointment status.");
    } finally {
      setPendingActionIds(p => {
        const next = new Set(p);
        next.delete(appointmentId);
        return next;
      });
    }
  };

  const openReviewModal = (id) => {
    setReviewAppId(id);
    setReviewForm({ patientFeeling: "Same", patientRating: 5, patientReview: "" });
  };

  const handleReviewSubmit = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/appointments/${reviewAppId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reviewForm)
      });
      if (response.ok) {
        setReviewAppId(null);
        fetchAppointments();
      } else {
        alert("Failed to submit review");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const upcomingAppointments = appointments.filter(a => ["Pending", "Confirmed", "Rescheduled"].includes(a.status));
  const completedAppointments = appointments.filter(a => ["Completed", "Cancelled"].includes(a.status));

  // Doctors returned by the API are already city-filtered
  // Sort: available doctors first
  const sortedDoctors = [...doctors].sort((a, b) => {
    const aAvail = a.profile?.isAvailable ? 1 : 0;
    const bAvail = b.profile?.isAvailable ? 1 : 0;
    return bAvail - aAvail;
  });

  const renderDoctorCard = (doctor) => {
    const isAvailable = doctor.profile?.isAvailable;
    const rating = doctor.profile?.rating || 0;
    const fullStars = Math.round(rating);
    return (
      <div className="doctor-card-appointments" key={doctor._id} style={{ flexDirection: 'row', alignItems: 'stretch', textAlign: 'left', padding: 0, gap: 0, overflow: 'hidden' }}>
        {/* Left accent strip */}
        <div style={{ width: '6px', background: isAvailable ? 'linear-gradient(180deg,#22c55e,#16a34a)' : 'linear-gradient(180deg,#94a3b8,#64748b)', flexShrink: 0 }} />

        <div style={{ flex: 1, padding: '20px 20px 20px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Top row: avatar + name + badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <img src={physio} alt={doctor.name} style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #e2e8f0' }} />
              <span style={{
                position: 'absolute', bottom: '-2px', right: '-6px',
                background: isAvailable ? 'linear-gradient(135deg,#22c55e,#16a34a)' : '#94a3b8',
                color: '#fff', fontSize: '9px', fontWeight: '700',
                padding: '2px 6px', borderRadius: '8px',
                boxShadow: '0 1px 4px rgba(0,0,0,0.15)', whiteSpace: 'nowrap'
              }}>
                {isAvailable ? '● Available' : '● Unavailable'}
              </span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{ margin: '0 0 2px', fontSize: '16px', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{doctor.name}</h3>
              <p style={{ margin: 0, fontSize: '12px', fontWeight: '600', color: 'var(--primary)' }}>{doctor.profile?.specialization || 'Physiotherapist'}</p>
            </div>
          </div>

          {/* Location */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#64748b' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            <span>{doctor.city || 'Location not set'}</span>
          </div>

          {/* Stats chips */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ background: '#f1f5f9', color: '#475569', fontSize: '11px', fontWeight: '600', padding: '4px 10px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>
              {doctor.profile?.experience || '0 Yrs'}
            </span>
            <span style={{ background: '#f1f5f9', color: '#475569', fontSize: '11px', fontWeight: '600', padding: '4px 10px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
              {doctor.profile?.patientsCount || '0+'} Patients
            </span>
            <span style={{ background: '#fffbeb', color: '#b45309', fontSize: '11px', fontWeight: '700', padding: '4px 10px', borderRadius: '20px' }}>
              {'★'.repeat(fullStars)}{'☆'.repeat(5-fullStars)} {rating > 0 ? rating.toFixed(1) : 'New'}
            </span>
          </div>

          {/* Book button */}
          <button className="dca-book-btn" onClick={() => setSelectedDoctor(doctor)} style={{ marginTop: 'auto' }}>
            Book Appointment
          </button>
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="patient-appointments-page">
        <div className="page-top-header">
          <h1>Appointments</h1>
        </div>

        <div className="tab-container">
          <div className="tabs-wrapper">
            <button
              className={`tab-btn ${tab === "upcoming" ? "active" : ""}`}
              onClick={() => setTab("upcoming")}
            >
              Upcoming
            </button>
            <button
              className={`tab-btn ${tab === "completed" ? "active" : ""}`}
              onClick={() => setTab("completed")}
            >
              Completed/Cancelled
            </button>
            <button
              className={`tab-btn ${tab === "doctors" ? "active" : ""}`}
              onClick={() => setTab("doctors")}
            >
              Our Doctors
            </button>
          </div>
        </div>

        <div className="appointments-content">
          {loading ? (
            <div className="cards-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[1, 2, 3].map(n => (
                <div key={n} style={{ height: '120px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)', animation: 'shimmer 1.5s infinite' }}></div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {tab === "upcoming" && (
                <div className="cards-list">
                  {upcomingAppointments.length === 0 ? (
                    <EmptyState icon="calendar" title="No upcoming appointments" message="You have no upcoming or pending physiotherapy visits scheduled." />
                  ) : null}
                  {upcomingAppointments.map((appointment) => (
                    <div className="appointment-card full-width" key={appointment._id}>
                      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{appointment.date} - {appointment.time}</span>
                        <span className={getStatusBadgeClass(appointment.status)}>{appointment.status}</span>
                      </div>
                      <div className="card-body">
                        <div className="doctor-info-row">
                          <img src={doc1} alt={appointment.doctorId?.name} className="doc-avatar" />
                          <div className="doc-details">
                            <h3>{appointment.doctorId?.name || 'Unknown Doctor'}</h3>
                            <div className="doc-specialty">{appointment.doctorId?.email}</div>
                            {appointment.notes && (
                              <div className="doc-fees">Notes: {appointment.notes}</div>
                            )}
                          </div>
                        </div>
                        <div className="card-actions">
                          <button
                            className="btn-outline"
                            onClick={() => handleUpdateStatus(appointment._id, "Cancelled")}
                            disabled={pendingActionIds.has(appointment._id)}
                            style={{
                              opacity: pendingActionIds.has(appointment._id) ? 0.6 : 1,
                              cursor: pendingActionIds.has(appointment._id) ? "not-allowed" : "pointer"
                            }}
                          >
                            {pendingActionIds.has(appointment._id) ? "Cancelling..." : "Cancel Appointment"}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {tab === "completed" && (
                <div className="cards-list">
                  {completedAppointments.length === 0 ? (
                    <EmptyState icon="document" title="No past appointments" message="Your completed and cancelled appointment history will be listed here." />
                  ) : null}
                  {completedAppointments.map((appointment) => (
                    <div className="appointment-card full-width" key={appointment._id}>
                      <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{appointment.date} - {appointment.time}</span>
                        <span className={getStatusBadgeClass(appointment.status)}>{appointment.status}</span>
                      </div>
                      <div className="card-body">
                        <div className="doctor-info-row">
                          <img src={doc1} alt={appointment.doctorId?.name} className="doc-avatar" />
                          <div className="doc-details">
                            <h3>{appointment.doctorId?.name || 'Unknown Doctor'}</h3>
                            <div className="doc-specialty">{appointment.doctorId?.email}</div>
                          </div>
                        </div>
                        {appointment.status === "Completed" && (
                            <div className="card-actions">
                              {!appointment.patientRating ? (
                                  <button className="btn-primary" style={{ background: 'var(--primary)', color: 'white', padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => openReviewModal(appointment._id)}>
                                    Rate Session
                                  </button>
                              ) : (
                                  <div style={{ color: '#166534', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <span>★</span> {appointment.patientRating}/5 - Reviewed
                                  </div>
                              )}
                            </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {tab === "doctors" && (
                <div className="doctors-section">
                  <div className="doctors-section-header">
                    <h2>Available Physiotherapists</h2>
                    <p>
                      {patientCity
                        ? `Showing physiotherapists in ${patientCity}`
                        : "Browse our team of certified professionals and book your appointment"}
                    </p>
                  </div>
                  {loadingDoctors ? (
                    <div className="doctors-grid-appointments" style={{ marginBottom: '32px' }}>
                      {[1, 2, 3].map(n => (
                        <div key={n} className="doctor-card-appointments" style={{ height: '220px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', position: 'relative', overflow: 'hidden' }}>
                          <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)', animation: 'shimmer 1.5s infinite' }}></div>
                        </div>
                      ))}
                    </div>
                  ) : sortedDoctors.length === 0 ? (
                    <p style={{ textAlign: 'center', color: '#64748b' }}>
                      {patientCity
                        ? `No doctors found in ${patientCity}. Try updating your city in your profile.`
                        : "No doctors available at the moment."}
                    </p>
                  ) : (
                    <div className="doctors-grid-appointments" style={{ marginBottom: '32px' }}>
                      {sortedDoctors.map(renderDoctorCard)}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {reviewAppId && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
              <div style={{ background: 'white', borderRadius: '16px', padding: '32px', width: '90%', maxWidth: '400px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                      <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#111827' }}>Rate Your Session</h3>
                      <button onClick={() => setReviewAppId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                      </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>How do you feel compared to last session?</label>
                          <select 
                              value={reviewForm.patientFeeling}
                              onChange={e => setReviewForm({...reviewForm, patientFeeling: e.target.value})}
                              style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '12px', boxSizing: 'border-box', outline: 'none', transition: 'all 0.2s', fontSize: '15px' }}
                              onFocus={(e) => { e.target.style.borderColor = 'var(--primary-500)'; e.target.style.boxShadow = '0 0 0 3px rgba(13, 148, 136, 0.1)'; }}
                              onBlur={(e) => { e.target.style.borderColor = '#cbd5e1'; e.target.style.boxShadow = 'none'; }}
                          >
                              <option value="Better">Better</option>
                              <option value="Same">Same</option>
                              <option value="Worse">Worse</option>
                          </select>
                      </div>

                      <div>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Rating (1-5)</label>
                          <div style={{ display: 'flex', gap: '8px' }}>
                              {[1,2,3,4,5].map(star => (
                                  <button 
                                      key={star}
                                      onClick={() => setReviewForm({...reviewForm, patientRating: star})}
                                      style={{ 
                                          background: 'none', 
                                          border: 'none', 
                                          fontSize: '28px', 
                                          cursor: 'pointer',
                                          color: star <= reviewForm.patientRating ? '#fbbf24' : '#e5e7eb',
                                          padding: 0
                                      }}
                                  >
                                      ★
                                  </button>
                              ))}
                          </div>
                      </div>

                      <div>
                          <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Review</label>
                          <textarea 
                              value={reviewForm.patientReview}
                              onChange={e => setReviewForm({...reviewForm, patientReview: e.target.value})}
                              placeholder="Any comments about the session?"
                              style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '12px', minHeight: '80px', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none', transition: 'all 0.2s', fontSize: '15px' }}
                              onFocus={(e) => { e.target.style.borderColor = 'var(--primary-500)'; e.target.style.boxShadow = '0 0 0 3px rgba(13, 148, 136, 0.1)'; }}
                              onBlur={(e) => { e.target.style.borderColor = '#cbd5e1'; e.target.style.boxShadow = 'none'; }}
                          />
                      </div>

                      <button 
                          onClick={handleReviewSubmit}
                          disabled={isSubmitting}
                          style={{ width: '100%', padding: '12px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '600', marginTop: '10px', cursor: isSubmitting ? 'not-allowed' : 'pointer', boxSizing: 'border-box' }}
                      >
                          {isSubmitting ? "Submitting..." : "Submit Review"}
                      </button>
                  </div>
              </div>
          </div>
      )}

      {selectedDoctor && (
        <DoctorProfileModal
          doctor={selectedDoctor}
          onClose={() => setSelectedDoctor(null)}
        />
      )}

    </Layout>
  );
}

export default AppointmentsPage;