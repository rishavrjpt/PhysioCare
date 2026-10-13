import { useState, useRef } from "react";
import { decodeToken } from "../utils/auth";
import { useNavigate } from "react-router-dom";
import "../style/patientOnboarding.css";
import { API_BASE_URL } from "../config";
import { emitProfileUpdated } from "../utils/dataStore";
import { resizeImage } from "../utils/imageUtils";

function PatientOnboarding() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Separate digit-only states for phone fields
  const [phoneDigits, setPhoneDigits] = useState("");
  const [emergencyDigits, setEmergencyDigits] = useState("");

  const [form, setForm] = useState({
    profilePhoto: "",
    phone: "",
    dateOfBirth: "",
    gender: "",
    bloodGroup: "",
    city: "",
    currentCondition: "",
    existingConditions: "",
    pastSurgeries: "",
    emergencyContactName: "",
    emergencyContactNumber: ""
  });

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  // Only allow digits, max 10
  const handlePhoneInput = (val, setter, field) => {
    const digits = val.replace(/\D/g, "").slice(0, 10);
    setter(digits);
    update(field, digits ? `+91${digits}` : "");
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const resized = await resizeImage(file, { maxWidth: 256, maxHeight: 256, quality: 0.8, format: "image/webp" });
      update("profilePhoto", resized);
    } catch (err) {
      console.error("Photo processing error:", err);
      setError("Could not process image. Please try another photo.");
    }
  };

  const handleNext = () => {
    setError("");
    if (!phoneDigits || phoneDigits.length !== 10) {
      setError("Please enter a valid 10-digit phone number.");
      return;
    }
    if (!form.city) {
      setError("City is required.");
      return;
    }
    setStep(2);
  };

  const handleSubmit = async () => {
    setError("");
    setSubmitting(true);

    const token = localStorage.getItem("patientToken");
    if (!token) {
      setError("Session expired. Please log in again.");
      setSubmitting(false);
      return;
    }

    try {
      const payload = decodeToken(token);
      const response = await fetch(`${API_BASE_URL}/auth/${payload.id}/complete-profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });

      const data = await response.json();
      if (response.ok) {
        emitProfileUpdated(payload.id);
        navigate("/dashboard");
      } else {
        setError(data.msg || "Failed to save profile.");
      }
    } catch (err) {
      console.error(err);
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="onboarding-page">
      {/* Logo */}
      <div className="onboarding-logo">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <rect width="32" height="32" rx="8" fill="var(--primary-500)" />
          <path d="M16 8V24M8 16H24" stroke="white" strokeWidth="4" strokeLinecap="round" />
        </svg>
        <span>PhysioCare</span>
      </div>

      {/* Progress */}
      <div className="onboarding-progress">
        <div className="progress-label">
          <span>Complete Your Profile</span>
          <span className="step-text">Step {step} of 2</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: step === 1 ? "50%" : "100%" }}></div>
        </div>
      </div>

      {/* Card */}
      <div className="onboarding-card" key={step}>
        {step === 1 && (
          <>
            <h2>Personal Details</h2>
            <p className="subtitle">Tell us a bit about yourself</p>

            <div className="photo-upload">
              <div className="photo-preview" onClick={() => fileInputRef.current?.click()}>
                {form.profilePhoto ? (
                  <img src={form.profilePhoto} alt="Profile" />
                ) : (
                  <svg className="upload-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                )}
              </div>
              <span className="photo-label">Upload Photo</span>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handlePhotoUpload} />
            </div>

            <div className="ob-form-row">
              <div className="ob-form-group">
                <label>Phone Number *</label>
                <div className="phone-input-wrap">
                  <span className="phone-prefix">+91</span>
                  <input
                    type="tel"
                    placeholder="98765 43210"
                    value={phoneDigits}
                    maxLength={10}
                    inputMode="numeric"
                    onChange={(e) => handlePhoneInput(e.target.value, setPhoneDigits, "phone")}
                  />
                </div>
                {phoneDigits.length > 0 && phoneDigits.length < 10 && (
                  <span className="phone-hint">{10 - phoneDigits.length} more digit{10 - phoneDigits.length !== 1 ? "s" : ""} needed</span>
                )}
              </div>
              <div className="ob-form-group">
                <label>Date of Birth</label>
                <input type="date" value={form.dateOfBirth} onChange={(e) => update("dateOfBirth", e.target.value)} />
              </div>
            </div>

            <div className="ob-form-row">
              <div className="ob-form-group">
                <label>Gender</label>
                <select value={form.gender} onChange={(e) => update("gender", e.target.value)}>
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="ob-form-group">
                <label>Blood Group</label>
                <select value={form.bloodGroup} onChange={(e) => update("bloodGroup", e.target.value)}>
                  <option value="">Select</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                </select>
              </div>
            </div>

            <div className="ob-form-group">
              <label>City *</label>
              <input type="text" placeholder="e.g. Chennai, Mumbai, Delhi" value={form.city} onChange={(e) => update("city", e.target.value)} />
            </div>

            {error && <div className="ob-error">{error}</div>}

            <div className="ob-actions">
              <button className="ob-btn-next" onClick={handleNext}>Continue →</button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2>Health Details</h2>
            <p className="subtitle">Help us understand your needs better</p>

            <div className="ob-form-group">
              <label>Current Condition / Reason for Physiotherapy</label>
              <textarea placeholder="e.g. Lower back pain, post-surgery recovery..." value={form.currentCondition} onChange={(e) => update("currentCondition", e.target.value)} />
            </div>

            <div className="ob-form-group">
              <label>Existing Medical Conditions</label>
              <textarea placeholder="e.g. Diabetes, High Blood Pressure, Asthma..." value={form.existingConditions} onChange={(e) => update("existingConditions", e.target.value)} />
            </div>

            <div className="ob-form-group">
              <label>Past Surgeries / Injuries</label>
              <textarea placeholder="e.g. Knee replacement (2022), ACL tear..." value={form.pastSurgeries} onChange={(e) => update("pastSurgeries", e.target.value)} />
            </div>

            <div className="ob-form-row">
              <div className="ob-form-group">
                <label>Emergency Contact Name</label>
                <input type="text" placeholder="Full name" value={form.emergencyContactName} onChange={(e) => update("emergencyContactName", e.target.value)} />
              </div>
              <div className="ob-form-group">
                <label>Emergency Contact Number</label>
                <div className="phone-input-wrap">
                  <span className="phone-prefix">+91</span>
                  <input
                    type="tel"
                    placeholder="98765 43210"
                    value={emergencyDigits}
                    maxLength={10}
                    inputMode="numeric"
                    onChange={(e) => handlePhoneInput(e.target.value, setEmergencyDigits, "emergencyContactNumber")}
                  />
                </div>
                {emergencyDigits.length > 0 && emergencyDigits.length < 10 && (
                  <span className="phone-hint">{10 - emergencyDigits.length} more digit{10 - emergencyDigits.length !== 1 ? "s" : ""} needed</span>
                )}
              </div>
            </div>

            {error && <div className="ob-error">{error}</div>}

            <div className="ob-actions">
              <button className="ob-btn-back" onClick={() => { setStep(1); setError(""); }}>← Back</button>
              <button className="ob-btn-submit" onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Saving..." : "Complete Setup ✓"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default PatientOnboarding;
