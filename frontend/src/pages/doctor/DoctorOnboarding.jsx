import { useState, useRef } from "react";
import { decodeToken } from "../../utils/auth";
import { useNavigate } from "react-router-dom";
import "../../style/patientOnboarding.css";
import { API_BASE_URL } from "../../config";
import { emitProfileUpdated } from "../../utils/dataStore";
import { resizeImage } from "../../utils/imageUtils";

const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function DoctorOnboarding() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [langInput, setLangInput] = useState("");
  const [phoneDigits, setPhoneDigits] = useState("");

  const [form, setForm] = useState({
    profilePhoto: "",
    phone: "",
    city: "",
    experience: "",
    bio: "",
    licenceNumber: "",
    hospitalName: "",
    fees: "",
    availableDays: [],
    availableTimeStart: "",
    availableTimeEnd: "",
    languages: []
  });

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  // Only allow digits, max 10 — stores +91XXXXXXXXXX in form
  const handlePhoneInput = (val) => {
    const digits = val.replace(/\D/g, "").slice(0, 10);
    setPhoneDigits(digits);
    update("phone", digits ? `+91${digits}` : "");
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

  const toggleDay = (day) => {
    setForm(prev => ({
      ...prev,
      availableDays: prev.availableDays.includes(day)
        ? prev.availableDays.filter(d => d !== day)
        : [...prev.availableDays, day]
    }));
  };

  const addLanguage = () => {
    const lang = langInput.trim();
    if (lang && !form.languages.includes(lang)) {
      update("languages", [...form.languages, lang]);
    }
    setLangInput("");
  };

  const removeLanguage = (lang) => {
    update("languages", form.languages.filter(l => l !== lang));
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

    const token = localStorage.getItem("doctorToken");
    if (!token) {
      setError("Session expired. Please log in again.");
      setSubmitting(false);
      return;
    }

    try {
      const payload = decodeToken(token);
      const body = {
        ...form,
        fees: form.fees ? Number(form.fees) : 0,
        experience: form.experience ? `${form.experience} Years` : "0 Years"
      };

      const response = await fetch(`${API_BASE_URL}/auth/${payload.id}/complete-profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      if (response.ok) {
        emitProfileUpdated(payload.id);
        navigate("/doctor/dashboard");
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
            <p className="subtitle">Tell us about yourself</p>

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
                    onChange={(e) => handlePhoneInput(e.target.value)}
                  />
                </div>
                {phoneDigits.length > 0 && phoneDigits.length < 10 && (
                  <span className="phone-hint">{10 - phoneDigits.length} more digit{10 - phoneDigits.length !== 1 ? "s" : ""} needed</span>
                )}
              </div>
              <div className="ob-form-group">
                <label>City / Location *</label>
                <input type="text" placeholder="e.g. Chennai" value={form.city} onChange={(e) => update("city", e.target.value)} />
              </div>
            </div>

            <div className="ob-form-group">
              <label>Years of Experience</label>
              <input type="number" placeholder="e.g. 5" min="0" value={form.experience} onChange={(e) => update("experience", e.target.value)} />
            </div>

            <div className="ob-form-group">
              <label>Short Bio (2–3 lines about yourself)</label>
              <textarea placeholder="Tell patients about your expertise and approach..." value={form.bio} onChange={(e) => update("bio", e.target.value)} />
            </div>

            {error && <div className="ob-error">{error}</div>}

            <div className="ob-actions">
              <button className="ob-btn-next" onClick={handleNext}>Continue →</button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2>Professional Details</h2>
            <p className="subtitle">Set up your practice information</p>

            <div className="ob-form-row">
              <div className="ob-form-group">
                <label>Licence / Registration Number</label>
                <input type="text" placeholder="e.g. MCI-12345" value={form.licenceNumber} onChange={(e) => update("licenceNumber", e.target.value)} />
              </div>
              <div className="ob-form-group">
                <label>Hospital / Clinic Name</label>
                <input type="text" placeholder="e.g. Apollo Hospital" value={form.hospitalName} onChange={(e) => update("hospitalName", e.target.value)} />
              </div>
            </div>

            <div className="ob-form-group">
              <label>Consultation Fee (₹)</label>
              <input type="number" placeholder="e.g. 500" min="0" value={form.fees} onChange={(e) => update("fees", e.target.value)} />
            </div>

            <div className="ob-form-group">
              <label>Available Days</label>
              <div className="days-selector">
                {ALL_DAYS.map(day => (
                  <div
                    key={day}
                    className={`day-chip ${form.availableDays.includes(day) ? "selected" : ""}`}
                    onClick={() => toggleDay(day)}
                  >
                    {day}
                  </div>
                ))}
              </div>
            </div>

            <div className="ob-form-row">
              <div className="ob-form-group">
                <label>Available From</label>
                <input type="time" value={form.availableTimeStart} onChange={(e) => update("availableTimeStart", e.target.value)} />
              </div>
              <div className="ob-form-group">
                <label>Available Until</label>
                <input type="time" value={form.availableTimeEnd} onChange={(e) => update("availableTimeEnd", e.target.value)} />
              </div>
            </div>

            <div className="ob-form-group">
              <label>Languages Spoken</label>
              {form.languages.length > 0 && (
                <div className="languages-input">
                  {form.languages.map(lang => (
                    <span className="lang-tag" key={lang}>
                      {lang}
                      <button onClick={() => removeLanguage(lang)}>×</button>
                    </span>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  placeholder="Type a language and press Add"
                  value={langInput}
                  onChange={(e) => setLangInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLanguage(); } }}
                />
                <button
                  type="button"
                  onClick={addLanguage}
                  style={{
                    padding: "10px 16px", background: "var(--primary-500)", color: "#fff",
                    border: "none", borderRadius: "10px", fontWeight: "600",
                    cursor: "pointer", whiteSpace: "nowrap", fontFamily: "Inter, sans-serif"
                  }}
                >
                  Add
                </button>
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

export default DoctorOnboarding;
