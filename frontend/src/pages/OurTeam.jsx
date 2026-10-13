import { useState, useEffect } from "react";
import Layout from "../components/Layout";
import DoctorLayout from "../components/DoctorLayout";
import { API_BASE_URL, BACKEND_URL } from "../config";
import "../style/ourTeam.css";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BACKEND_ROOT = BACKEND_URL;

function photoUrl(photo) {
  if (!photo) return null;
  if (photo.startsWith("http")) return photo;
  return `${BACKEND_ROOT}${photo}`;
}

function initials(name = "") {
  return name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
}

// ─── PAGE 1: Home ─────────────────────────────────────────────────────────────

function TeamHome({ onAdd, onView }) {
  return (
    <div className="team-home-page">
      <div className="team-home-content">
        <div className="team-home-hero">
          <h1 className="team-home-title">Team 20</h1>
          <p className="team-home-subtitle">Welcome to the Team 20 Management</p>
        </div>

        <div className="team-manage-box">
          <div className="manage-header">
            <h3>Manage Team</h3>
          </div>
          
          <div className="team-manage-btns">
            <button className="btn-manage-card" onClick={onAdd}>
              <div className="btn-text">
                <span className="btn-label">Add Member</span>
              </div>
              <div className="btn-arrow">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </div>
            </button>

            <button className="btn-manage-card" onClick={onView}>
              <div className="btn-text">
                <span className="btn-label">View Members</span>
              </div>
              <div className="btn-arrow">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </div>
            </button>
          </div>
        </div>
      </div>
      
      {/* Decorative background elements */}
      <div className="bg-blob blob-1"></div>
      <div className="bg-blob blob-2"></div>
    </div>
  );
}

// ─── PAGE 2: Add Member ───────────────────────────────────────────────────────

function AddMemberForm({ onBack, onSuccess }) {
  const [form, setForm] = useState({
    name: "", rollNumber: "", year: "", degree: "",
    aboutProject: "", hobbies: "", certificate: "",
    internship: "", aboutYou: "",
  });
  const [photo, setPhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const handle = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { setFeedback({ type: "error", msg: "Name is required." }); return; }
    setSubmitting(true);
    setFeedback(null);
    try {
      const body = new FormData();
      Object.entries(form).forEach(([k, v]) => body.append(k, v));
      if (photo) body.append("photo", photo);
      const res = await fetch(`${API_BASE_URL}/members`, { method: "POST", body });
      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: "success", msg: `✅ ${data.name} added successfully!` });
        setForm({ name:"",rollNumber:"",year:"",degree:"",aboutProject:"",hobbies:"",certificate:"",internship:"",aboutYou:"" });
        setPhoto(null);
        setTimeout(() => onSuccess(), 1200);
      } else {
        setFeedback({ type: "error", msg: `❌ ${data.msg || "Failed to add member."}` });
      }
    } catch { setFeedback({ type: "error", msg: "❌ Server error. Please try again." }); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="add-page-wrapper">
      <div className="add-member-card">
        <button className="team-back-btn" onClick={onBack}>← Back</button>
        <h2>Add Team Member</h2>

        <form onSubmit={handleSubmit} noValidate>
          <input className="ref-input" name="name"         value={form.name}         onChange={handle} placeholder="Name" required />
          <input className="ref-input" name="rollNumber"   value={form.rollNumber}   onChange={handle} placeholder="Roll Number" />
          <input className="ref-input" name="year"         value={form.year}         onChange={handle} placeholder="Year" />
          <input className="ref-input" name="degree"       value={form.degree}       onChange={handle} placeholder="Degree" />
          <textarea className="ref-textarea" name="aboutProject" value={form.aboutProject} onChange={handle} placeholder="About Project" />
          <input className="ref-input" name="hobbies"      value={form.hobbies}      onChange={handle} placeholder="Hobbies (comma separated)" />
          <input className="ref-input" name="certificate"  value={form.certificate}  onChange={handle} placeholder="Certificate" />
          <input className="ref-input" name="internship"   value={form.internship}   onChange={handle} placeholder="Internship" />
          <textarea className="ref-textarea" name="aboutYou" value={form.aboutYou}   onChange={handle} placeholder="About Your Aim" />

          <div className="ref-file-row">
            <input type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files[0])} />
          </div>

          {feedback && <p className={`form-feedback ${feedback.type}`}>{feedback.msg}</p>}

          <button type="submit" className="btn-submit-ref" disabled={submitting}>
            {submitting ? "SUBMITTING…" : "SUBMIT"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── PAGE 3: View Members ─────────────────────────────────────────────────────

function ViewMembers({ onBack, onDetail }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/members`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => setMembers(d))
      .catch(() => setError("Could not load members."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="view-page-wrapper">
      <button className="team-back-btn" onClick={onBack}>← Back</button>

      <h2 className="view-page-heading">MEET OUR TEAM 20</h2>

      {loading && <p className="team-loading">Loading…</p>}
      {error   && <div className="team-empty-state"><p>{error}</p></div>}

      {!loading && !error && members.length === 0 && (
        <div className="team-empty-state">
          <svg width="64" height="64" fill="none" stroke="#9ca3af" strokeWidth="1.5" viewBox="0 0 24 24">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <p>No team members yet. Add the first one!</p>
        </div>
      )}

      {!loading && !error && members.length > 0 && (
        <div className="member-grid">
          {members.map((m) => {
            const url = photoUrl(m.photo);
            return (
              <div className="member-card" key={m._id}>
                <div className="member-card-photo">
                  {url
                    ? <img src={url} alt={m.name} />
                    : <div className="member-card-photo-placeholder">{initials(m.name)}</div>
                  }
                </div>
                <div className="member-card-info">
                  <p className="member-name">{m.name}</p>
                  {m.rollNumber && <p className="member-roll-text">Roll Number: {m.rollNumber}</p>}
                  <button className="btn-view-details" onClick={() => onDetail(m._id)}>
                    VIEW DETAILS
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── PAGE 4: Member Detail ────────────────────────────────────────────────────

function MemberDetail({ memberId, onBack }) {
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/members/${memberId}`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d) => setMember(d))
      .catch(() => setError("Could not load member details."))
      .finally(() => setLoading(false));
  }, [memberId]);

  if (loading) return <p className="team-loading">Loading details…</p>;
  if (error)   return (
    <div className="detail-page-wrapper">
      <button className="team-back-btn" onClick={onBack}>← Back</button>
      <p style={{ color: "#dc2626" }}>{error}</p>
    </div>
  );

  const url = photoUrl(member.photo);
  const hobbyList = member.hobbies
    ? member.hobbies.split(",").map(h => h.trim()).filter(Boolean)
    : [];

  return (
    <div className="detail-page-wrapper">
      <div className="member-detail-wrapper">
        <button className="team-back-btn" onClick={onBack}>← Back to Members</button>

        <div className="member-detail-card">
          {/* Large photo at top */}
          <div className="member-detail-photo">
            {url
              ? <img src={url} alt={member.name} />
              : <div className="member-detail-photo-placeholder">{initials(member.name)}</div>
            }
          </div>

          {/* Name + degree – year */}
          <div className="member-detail-nameblock">
            <h2>{member.name}</h2>
            {(member.degree || member.year) && (
              <p className="member-detail-subtitle">
                {[member.degree, member.year].filter(Boolean).join(" - ")}
              </p>
            )}
          </div>

          {/* Info rows */}
          <div className="member-detail-rows">
            {member.rollNumber   && <p className="detail-inline-row"><strong>Roll Number:</strong> {member.rollNumber}</p>}
            {member.aboutProject && <p className="detail-inline-row"><strong>Project:</strong> {member.aboutProject}</p>}
            {member.certificate  && <p className="detail-inline-row"><strong>Certificate:</strong> {member.certificate}</p>}
            {member.internship   && <p className="detail-inline-row"><strong>Internship:</strong> {member.internship}</p>}
            {member.aboutYou     && <p className="detail-inline-row"><strong>About Your Aim:</strong> {member.aboutYou}</p>}

            {hobbyList.length > 0 && (
              <div className="detail-hobbies-section">
                <p className="detail-hobbies-label">Hobbies:</p>
                <div className="detail-hobbies-pills">
                  {hobbyList.map((h, i) => <span key={i} className="hobby-pill">{h}</span>)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Controller ──────────────────────────────────────────────────────────

function OurTeamContent() {
  const [view, setView]       = useState("home"); // home | add | list | detail
  const [detailId, setDetailId] = useState(null);

  return (
    <div style={{ width: "100%" }}>
      {view === "home"   && <TeamHome   onAdd={() => setView("add")} onView={() => setView("list")} />}
      {view === "add"    && <AddMemberForm onBack={() => setView("home")} onSuccess={() => setView("list")} />}
      {view === "list"   && <ViewMembers  onBack={() => setView("home")} onDetail={(id) => { setDetailId(id); setView("detail"); }} />}
      {view === "detail" && <MemberDetail memberId={detailId} onBack={() => setView("list")} />}
    </div>
  );
}

// ─── Exported entry points (Patient + Doctor) ─────────────────────────────────

export function OurTeamPatient() {
  return <Layout><OurTeamContent /></Layout>;
}

export function OurTeamDoctor() {
  return <DoctorLayout><OurTeamContent /></DoctorLayout>;
}

export default OurTeamPatient;
