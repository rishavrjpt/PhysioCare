import React, { useState, useEffect } from "react";
import { decodeToken } from "../utils/auth";
import "./DoctorProfileModal.css";
import { API_BASE_URL } from "../config";

function DoctorProfileModal({ doctor, onClose }) {
    const [bookingStep, setBookingStep] = useState(0); // 0: Profile, 1: Date/Time, 2: Success
    const [date, setDate] = useState("");
    const [time, setTime] = useState("");
    const [notes, setNotes] = useState("");
    const [bookingError, setBookingError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Reset everything when a new doctor is opened
    useEffect(() => {
        setBookingStep(0);
        setDate("");
        setTime("");
        setNotes("");
        setBookingError("");
        setIsSubmitting(false);
    }, [doctor]);

    // Generate time slots based on doctor's availability
    const generateTimeSlots = () => {
        if (!doctor) return [];
        const slots = [];
        const startTime = doctor.profile?.availableTimeStart || "09:00";
        const endTime = doctor.profile?.availableTimeEnd || "17:00";

        let [startHour, startMin] = startTime.split(":").map(Number);
        let [endHour, endMin] = endTime.split(":").map(Number);

        let currentHour = startHour;
        let currentMin = startMin;

        while (currentHour < endHour || (currentHour === endHour && currentMin <= endMin)) {
            const period = currentHour >= 12 ? 'PM' : 'AM';
            const displayHour = currentHour > 12 ? currentHour - 12 : (currentHour === 0 ? 12 : currentHour);
            const timeString = `${displayHour.toString().padStart(2, '0')}:${currentMin.toString().padStart(2, '0')} ${period}`;
            slots.push(timeString);

            currentMin += 30;
            if (currentMin >= 60) {
                currentHour += 1;
                currentMin = 0;
            }
        }
        return slots;
    };

    const availableSlots = generateTimeSlots();

    const handleBookClick = () => {
        setBookingError("");
        setBookingStep(1);
    };

    const handleConfirmBooking = async () => {
        if (!date || !time) {
            setBookingError("Please select both date and time.");
            return;
        }

        // Get the logged-in patient's ID from the token
        const token = localStorage.getItem("patientToken");
        let patientId = null;
        if (token) {
            try {
                const payload = decodeToken(token);
                patientId = payload.id;
            } catch {
                setBookingError("Session invalid. Please log in again.");
                return;
            }
        }

        if (!patientId) {
            setBookingError("Please log in first to book an appointment.");
            return;
        }

        setIsSubmitting(true);
        setBookingError("");

        try {
            const response = await fetch(`${API_BASE_URL}/appointments`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({
                    patientId,
                    doctorId: doctor._id,
                    date,
                    time,
                    notes
                })
            });

            const data = await response.json();

            if (response.ok) {
                setBookingStep(2);
            } else {
                setBookingError(data.msg || "Failed to book appointment. Please try again.");
            }
        } catch (error) {
            console.error("Booking failed:", error);
            setBookingError("Network error. Please check your connection and try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!doctor) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content doctor-profile-modal">
                <button className="close-btn" onClick={onClose}>&times;</button>

                {bookingStep === 0 && (
                    <div className="profile-view">
                        <h2>{doctor.name}</h2>
                        <p className="role" style={{ marginBottom: '4px' }}>{doctor.profile?.specialization || "Physiotherapist"}</p>
                        <p className="location" style={{ fontSize: '14px', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '20px' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                            {doctor.city || "Location not set"}
                        </p>

                        <div className="stats-grid">
                            <div className="stat-item">
                                <span className="stat-label">Experience</span>
                                <span className="stat-value">{doctor.profile?.experience || "0 Years"}</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-label">Patients</span>
                                <span className="stat-value">{doctor.profile?.patientsCount || "0+"}</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-label">Rating</span>
                                <span className="stat-value">⭐ {doctor.profile?.rating || 0}</span>
                            </div>
                            <div className="stat-item">
                                <span className="stat-label">Fees</span>
                                <span className="stat-value">₹{doctor.profile?.fees || 0}</span>
                            </div>
                        </div>

                        <div className="about-section">
                            <h3>About</h3>
                            <p>{doctor.profile?.about || "No details provided."}</p>
                        </div>

                        <div className="action-buttons">
                            <button className="btn btn-primary" onClick={handleBookClick}>Book Appointment</button>
                        </div>
                    </div>
                )}

                {bookingStep === 1 && (
                    <div className="booking-view">
                        <h3>Book Appointment with {doctor.name}</h3>
                        <div className="form-group">
                            <label>Select Date</label>
                            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                        </div>
                        <div className="form-group">
                            <label>Select Time</label>
                            <div className="time-slots-container" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '8px' }}>
                                {availableSlots.map(slot => (
                                    <button
                                        key={slot}
                                        type="button"
                                        onClick={() => setTime(slot)}
                                        style={{
                                            padding: '8px 16px',
                                            borderRadius: '8px',
                                            border: time === slot ? '2px solid var(--primary-500)' : '1px solid #e2e8f0',
                                            background: time === slot ? 'var(--primary-50)' : '#ffffff',
                                            color: time === slot ? 'var(--primary-hover)' : '#475569',
                                            cursor: 'pointer',
                                            fontWeight: time === slot ? '600' : '500',
                                            fontSize: '14px',
                                            transition: 'all 0.2s ease'
                                        }}
                                    >
                                        {slot}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="form-group">
                            <label>Notes (Optional)</label>
                            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason for visit..."></textarea>
                        </div>
                        {bookingError && (
                            <p style={{ color: "red", fontSize: "13px", marginBottom: "8px", textAlign: "center" }}>
                                {bookingError}
                            </p>
                        )}
                        <div className="action-buttons">
                            <button className="btn btn-secondary" onClick={() => setBookingStep(0)} disabled={isSubmitting}>Back</button>
                            <button
                                className="btn btn-primary"
                                onClick={handleConfirmBooking}
                                disabled={!date || !time || isSubmitting}
                            >
                                {isSubmitting ? "Booking..." : "Confirm Booking"}
                            </button>
                        </div>
                    </div>
                )}

                {bookingStep === 2 && (
                    <div className="success-view">
                        <div className="success-icon">✅</div>
                        <h3>Appointment Booked!</h3>
                        <p>Your appointment with <strong>{doctor.name}</strong> on <strong>{date}</strong> at <strong>{time}</strong> has been requested successfully.</p>
                        <button className="btn btn-primary" onClick={onClose}>Done</button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default DoctorProfileModal;
