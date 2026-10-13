import { useState, useEffect } from "react";
import { decodeToken } from "../../utils/auth";
import DoctorSidebar from "../../components/DoctorSidebar";
import "../../style/doctor/doctorPrograms.css";
import { API_BASE_URL, BACKEND_URL } from "../../config";

function DoctorPrograms() {
    const [programs, setPrograms] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Modal visibilities
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showManageModal, setShowManageModal] = useState(false);
    const [showPatientsModal, setShowPatientsModal] = useState(false);
    const [programPatients, setProgramPatients] = useState([]);
    const [isFetchingPatients, setIsFetchingPatients] = useState(false);
    
    // Create form state
    const [newProgram, setNewProgram] = useState({ title: "", description: "", specialty: "Rehabilitation" });
    const [isCreating, setIsCreating] = useState(false);

    // Upload Video form state
    const [selectedProgramId, setSelectedProgramId] = useState(null);
    const [uploadType, setUploadType] = useState('link'); // 'link' or 'file'
    const [newVideo, setNewVideo] = useState({ title: "", description: "", duration: "", url: "", file: null });
    const [isUploading, setIsUploading] = useState(false);

    // Manage Content state
    const [programVideos, setProgramVideos] = useState([]);
    const [editingVideo, setEditingVideo] = useState(null);
    const [isFetchingVideos, setIsFetchingVideos] = useState(false);

    // Three-dot menu state
    const [activeMenu, setActiveMenu] = useState(null);

    // Manage General Videos state
    const [showManageGeneralModal, setShowManageGeneralModal] = useState(false);
    const [generalVideos, setGeneralVideos] = useState([]);
    const [isFetchingGeneral, setIsFetchingGeneral] = useState(false);
    const [editingGeneralVideo, setEditingGeneralVideo] = useState(null);

    const fetchPrograms = async () => {
        const token = localStorage.getItem("doctorToken");
        if (!token) return;
        const payload = decodeToken(token);
        const doctorId = payload.id;

        try {
            const res = await fetch(`${API_BASE_URL}/programs/doctor/${doctorId}`);
            const data = await res.json();
            setPrograms(data);
        } catch (error) {
            console.error("Error fetching programs:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPrograms();
    }, []);

    // ---------------- Create & Delete Program ----------------

    const handleCreateProgram = async () => {
        if (!newProgram.title) return alert("Title is required");
        setIsCreating(true);
        const token = localStorage.getItem("doctorToken");
        const payload = decodeToken(token);

        try {
            const res = await fetch(`${API_BASE_URL}/programs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...newProgram, doctorId: payload.id })
            });
            if (res.ok) {
                await fetchPrograms(); 
                setShowCreateModal(false);
                setNewProgram({ title: "", description: "", specialty: "Rehabilitation" });
            }
        } catch (error) {
            console.error("Error creating program:", error);
        } finally {
            setIsCreating(false);
        }
    };

    const handleDeleteProgram = async (id) => {
        if (!window.confirm("Are you sure? This will delete the program and permanently remove all videos associated with it. Patients enrolled will lose access.")) return;
        
        const prevPrograms = programs;
        // Optimistically remove from UI
        setPrograms(programs.filter(p => p._id !== id));
        setActiveMenu(null);

        try {
            const res = await fetch(`${API_BASE_URL}/programs/${id}`, {
                method: "DELETE"
            });
            if (!res.ok) {
                setPrograms(prevPrograms);
                alert("Failed to delete program. Please try again.");
            }
        } catch (error) {
            console.error("Error deleting program:", error);
            setPrograms(prevPrograms);
            alert("Network error deleting program.");
        }
    };

    const handleViewPatients = async (programId) => {
        setActiveMenu(null);
        setShowPatientsModal(true);
        setIsFetchingPatients(true);
        try {
            const res = await fetch(`${API_BASE_URL}/programs/${programId}/patients`);
            const data = await res.json();
            setProgramPatients(data);
        } catch (error) {
            console.error("Error fetching patients:", error);
        } finally {
            setIsFetchingPatients(false);
        }
    };

    // ---------------- Videos Upload ----------------

    const extractVideoFrame = (file) => {
        return new Promise((resolve) => {
            // Timeout after 3s so a slow video doesn't block the upload
            const timer = setTimeout(() => resolve(null), 3000);

            const videoElement = document.createElement('video');
            videoElement.preload = 'metadata';
            videoElement.muted = true;
            videoElement.playsInline = true;
            videoElement.src = URL.createObjectURL(file);

            videoElement.onloadedmetadata = () => {
                videoElement.currentTime = Math.min(0.5, videoElement.duration / 4 || 0);
            };

            videoElement.onseeked = () => {
                clearTimeout(timer);
                try {
                    // Use a small fixed canvas (320px) instead of full video resolution
                    const MAX_W = 320;
                    const ratio = videoElement.videoHeight / (videoElement.videoWidth || 1);
                    const canvas = document.createElement('canvas');
                    canvas.width = MAX_W;
                    canvas.height = Math.round(MAX_W * ratio);
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
                    const dataURL = canvas.toDataURL('image/jpeg', 0.5); // lower quality = smaller size
                    URL.revokeObjectURL(videoElement.src);
                    resolve(dataURL);
                } catch {
                    resolve(null);
                }
            };

            videoElement.onerror = () => { clearTimeout(timer); resolve(null); };
        });
    };


    const getYouTubeThumbnail = (url) => {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? 
            `https://img.youtube.com/vi/${match[2]}/hqdefault.jpg` : null;
    };

    const openUploadModal = (programId) => {
        setSelectedProgramId(programId);
        setUploadType('link');
        setNewVideo({ title: "", description: "", duration: "", url: "", file: null });
        setShowUploadModal(true);
    };

    const handleUploadVideo = async () => {
        if (!newVideo.title) return alert("Title is required");
        if (uploadType === 'link' && !newVideo.url) return alert("URL is required");
        if (uploadType === 'file' && !newVideo.file) return alert("Please select a video file");
        
        setIsUploading(true);
        const token = localStorage.getItem("doctorToken");
        const payload = decodeToken(token);

        try {
            const formData = new FormData();
            formData.append("doctorId", payload.id);
            // Append Program ID only if uploading securely to a specific program
            if (selectedProgramId) formData.append("programId", selectedProgramId);
            formData.append("title", newVideo.title);
            formData.append("description", newVideo.description);
            formData.append("duration", newVideo.duration);

            let thumbnail = "";

            if (uploadType === 'link') {
                formData.append("url", newVideo.url);
                thumbnail = getYouTubeThumbnail(newVideo.url) || "";
            } else {
                formData.append("videoFile", newVideo.file);
                const generatedThumb = await extractVideoFrame(newVideo.file);
                if (generatedThumb) thumbnail = generatedThumb;
            }
            
            formData.append("thumbnail", thumbnail);

            const res = await fetch(`${API_BASE_URL}/videos`, {
                method: "POST",
                body: formData // Note: Don't set Content-Type header manually when sending FormData
            });

            if (res.ok) {
                alert("Video uploaded successfully!");
                setShowUploadModal(false);
            } else {
                const data = await res.json();
                alert(`Error: ${data.msg || "Upload failed"}`);
            }
        } catch (error) {
            console.error("Error uploading video:", error);
        } finally {
            setIsUploading(false);
        }
    };

    // ---------------- Manage Content (Edit/Delete Videos) ----------------

    const openManageModal = async (programId) => {
        setSelectedProgramId(programId);
        setShowManageModal(true);
        setIsFetchingVideos(true);
        try {
            const res = await fetch(`${API_BASE_URL}/videos/program/${programId}`);
            const data = await res.json();
            setProgramVideos(data);
        } catch (error) {
            console.error(error);
        } finally {
            setIsFetchingVideos(false);
        }
    };

    const handleDeleteVideo = async (videoId) => {
        if (!window.confirm("Delete this video permanently?")) return;
        const prevVideos = programVideos;
        setProgramVideos(prev => prev.filter(v => v._id !== videoId));

        try {
            const res = await fetch(`${API_BASE_URL}/videos/${videoId}`, { method: "DELETE" });
            if (!res.ok) {
                setProgramVideos(prevVideos);
                alert("Failed to delete video. Please try again.");
            }
        } catch(err) {
            console.error(err);
            setProgramVideos(prevVideos);
            alert("Network error deleting video.");
        }
    };

    const startEditingVideo = (vid) => {
        setEditingVideo({ ...vid });
    };

    const saveEditedVideo = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/videos/${editingVideo._id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    title: editingVideo.title, 
                    description: editingVideo.description,
                    duration: editingVideo.duration
                })
            });
            if (res.ok) {
                const updated = await res.json();
                setProgramVideos(programVideos.map(v => v._id === updated._id ? updated : v));
                setEditingVideo(null);
            }
        } catch (err) {
            console.error(err);
        }
    };

    // ---------------- Manage General Videos ----------------

    const openManageGeneralModal = async () => {
        setShowManageGeneralModal(true);
        setIsFetchingGeneral(true);
        const token = localStorage.getItem("doctorToken");
        if (!token) return;
        const payload = decodeToken(token);
        try {
            const res = await fetch(`${API_BASE_URL}/videos/general/doctor/${payload.id}`);
            const data = await res.json();
            setGeneralVideos(data);
        } catch (error) {
            console.error(error);
        } finally {
            setIsFetchingGeneral(false);
        }
    };

    const handleDeleteGeneralVideo = async (videoId) => {
        if (!window.confirm("Delete this general video permanently?")) return;
        const prevGeneral = generalVideos;
        setGeneralVideos(prev => prev.filter(v => v._id !== videoId));

        try {
            const res = await fetch(`${API_BASE_URL}/videos/${videoId}`, { method: "DELETE" });
            if (!res.ok) {
                setGeneralVideos(prevGeneral);
                alert("Failed to delete video. Please try again.");
            }
        } catch(err) {
            console.error(err);
            setGeneralVideos(prevGeneral);
            alert("Network error deleting video.");
        }
    };

    const saveEditedGeneralVideo = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/videos/${editingGeneralVideo._id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    title: editingGeneralVideo.title, 
                    description: editingGeneralVideo.description,
                    duration: editingGeneralVideo.duration
                })
            });
            if (res.ok) {
                const updated = await res.json();
                setGeneralVideos(generalVideos.map(v => v._id === updated._id ? updated : v));
                setEditingGeneralVideo(null);
            }
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="programs-page doctor-appointments-page" onClick={() => setActiveMenu(null)}>
            <DoctorSidebar />

            <div className="main" style={{ padding: '20px 40px', background: 'transparent' }}>
                <div className="content" style={{ maxWidth: '1400px', margin: '0 auto' }}>

                    {/* TOPBAR */}
                    <div className="topbar" style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 0', marginBottom: '20px' }}>
                        <div className="top-right" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div className="location" style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '14px', color: '#374151', fontWeight: '500' }}>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                <span>Chennai</span>
                            </div>
                            <div className="divider" style={{ width: '1px', height: '22px', background: '#d1d5db' }}></div>
                            <div className="icon-btn notification" style={{ position: 'relative', width: '40px', height: '40px', background: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', cursor: 'pointer' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                                <span className="badge" style={{ position: 'absolute', top: '-2px', right: '-2px', background: '#ef4444', color: 'white', fontSize: '10px', width: '16px', height: '16px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white' }}>1</span>
                            </div>
                        </div>
                    </div>

                    <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <div>
                            <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#111827', margin: '0 0 4px' }}>Program Library</h2>
                            <p style={{ fontSize: '14px', color: '#6b7280', margin: '0' }}>Manage programs and share codes with your patients.</p>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                            <button 
                                style={{ padding: '10px 20px', background: 'transparent', color: 'var(--primary)', border: '2px solid var(--primary)', borderRadius: '10px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                                onClick={() => openUploadModal(null)}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                                Upload General Video
                            </button>
                            <button 
                                style={{ padding: '10px 20px', background: 'transparent', color: '#7c3aed', border: '2px solid #7c3aed', borderRadius: '10px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                                onClick={openManageGeneralModal}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                Manage General Videos
                            </button>
                            <button 
                                style={{ padding: '10px 20px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '10px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                                onClick={() => setShowCreateModal(true)}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                Create Program
                            </button>
                        </div>
                    </div>

                    <div className="programs-container">
                        {loading ? (
                            <p>Loading programs...</p>
                        ) : programs.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '60px 20px', background: 'white', borderRadius: '12px', color: '#9ca3af' }}>
                                <h3>No programs created yet</h3>
                                <p style={{ fontSize: '14px', marginTop: '8px' }}>Create a program to start managing your patient sessions.</p>
                            </div>
                        ) : (
                            <div className="programs-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                                {programs.map(program => (
                                    <div key={program._id} style={{ background: 'white', borderRadius: '14px', padding: '24px', boxShadow: '0 2px 10px rgba(0,0,0,0.04)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                                        
                                        {/* Kebab Menu */}
                                        <div style={{ position: 'absolute', top: '20px', right: '16px' }}>
                                            <button 
                                                style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8' }}
                                                onClick={(e) => { e.stopPropagation(); setActiveMenu(activeMenu === program._id ? null : program._id); }}
                                            >
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>
                                            </button>
                                            {activeMenu === program._id && (
                                                <div style={{ position: 'absolute', top: '25px', right: '0', background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', borderRadius: '8px', zIndex: 10, width: '160px', overflow: 'hidden' }}>
                                                    <button 
                                                        onClick={() => handleViewPatients(program._id)}
                                                        style={{ width: '100%', padding: '12px 16px', background: 'none', borderBottom: '1px solid #e2e8f0', borderTop: 'none', borderLeft: 'none', borderRight: 'none', textAlign: 'left', color: '#0f172a', fontSize: '14px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                                                    >
                                                        View Patients
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteProgram(program._id)}
                                                        style={{ width: '100%', padding: '12px 16px', background: 'none', border: 'none', textAlign: 'left', color: '#ef4444', fontSize: '14px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
                                                    >
                                                        Delete Program
                                                    </button>
                                                </div>
                                            )}

                                        </div>

                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                            <div>
                                                <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--primary)', background: 'var(--primary-50)', padding: '4px 10px', borderRadius: '12px', display: 'inline-block', marginBottom: '8px' }}>
                                                    {program.specialty}
                                                </div>
                                                <h4 style={{ fontSize: '18px', fontWeight: '700', color: '#111827', margin: '0', maxWidth: '220px' }}>{program.title}</h4>
                                            </div>
                                        </div>
                                        
                                        <p style={{ fontSize: '14px', color: '#6b7280', margin: '0 0 20px 0', flex: 1 }}>{program.description || 'No description provided.'}</p>
                                        
                                        <div style={{ background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '10px', padding: '16px', textAlign: 'center', marginBottom: '20px' }}>
                                            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 4px 0', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700' }}>Program Code</p>
                                            <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', letterSpacing: '0.1em' }}>{program.programCode}</div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <button 
                                                style={{ flex: 1, padding: '10px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                                                onClick={() => openUploadModal(program._id)}
                                            >
                                                Upload Video
                                            </button>
                                            <button 
                                                onClick={() => openManageModal(program._id)}
                                                style={{ flex: 1, padding: '10px', background: '#fff', color: '#374151', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                                            >
                                                Manage Content
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* MODALS BELOW */}

            {/* CREATE PROGRAM MODAL */}
            {showCreateModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
                    <div style={{ background: 'white', borderRadius: '16px', padding: '32px', width: '90%', maxWidth: '500px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#111827' }}>Create New Program</h3>
                            <button onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Program Title</label>
                                <input 
                                    type="text" 
                                    value={newProgram.title}
                                    onChange={e => setNewProgram({...newProgram, title: e.target.value})}
                                    placeholder="e.g. 6-Week Knee strengthening"
                                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box' }}
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Specialty</label>
                                <select 
                                    value={newProgram.specialty}
                                    onChange={e => setNewProgram({...newProgram, specialty: e.target.value})}
                                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', background: 'white' }}
                                >
                                    <option value="Rehabilitation">Rehabilitation</option>
                                    <option value="Orthopedic">Orthopedic</option>
                                    <option value="Sports">Sports</option>
                                </select>
                            </div>
                            <button 
                                onClick={handleCreateProgram}
                                disabled={isCreating}
                                style={{ width: '100%', padding: '12px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: isCreating ? 'not-allowed' : 'pointer', marginTop: '8px', opacity: isCreating ? 0.7 : 1 }}
                            >
                                {isCreating ? "Generating Code..." : "Create Program"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* UPLOAD VIDEO MODAL */}
            {showUploadModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
                    <div style={{ background: 'white', borderRadius: '16px', padding: '32px', width: '90%', maxWidth: '500px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#111827' }}>Upload Video</h3>
                            <button onClick={() => setShowUploadModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        {/* Upload Toggles */}
                        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                            <button 
                                onClick={() => setUploadType('link')}
                                style={{ flex: 1, padding: '8px', borderRadius: '8px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', border: uploadType === 'link' ? 'none' : '1px solid #e5e7eb', background: uploadType === 'link' ? 'var(--primary-50)' : 'white', color: uploadType === 'link' ? 'var(--primary)' : '#64748b' }}
                            >
                                YouTube Link
                            </button>
                            <button 
                                onClick={() => setUploadType('file')}
                                style={{ flex: 1, padding: '8px', borderRadius: '8px', fontWeight: '600', fontSize: '13px', cursor: 'pointer', border: uploadType === 'file' ? 'none' : '1px solid #e5e7eb', background: uploadType === 'file' ? 'var(--primary-50)' : 'white', color: uploadType === 'file' ? 'var(--primary)' : '#64748b' }}
                            >
                                Upload File (.mp4)
                            </button>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Video Title</label>
                                <input 
                                    type="text" 
                                    value={newVideo.title}
                                    onChange={e => setNewVideo({...newVideo, title: e.target.value})}
                                    placeholder="e.g. Proper form for sit-ups"
                                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', background: 'white', color: '#111827' }}
                                />
                            </div>

                            {uploadType === 'link' ? (
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Video URL</label>
                                    <input 
                                        type="text" 
                                        value={newVideo.url}
                                        onChange={e => setNewVideo({...newVideo, url: e.target.value})}
                                        placeholder="https://youtube.com/..."
                                        style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', background: 'white', color: '#111827' }}
                                    />
                                </div>
                            ) : (
                                <div>
                                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Select File</label>
                                    <input 
                                        type="file" 
                                        accept="video/*"
                                        onChange={e => setNewVideo({...newVideo, file: e.target.files[0]})}
                                        style={{ width: '100%', padding: '10px 14px', border: '1px dashed #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', background: '#f8fafc', color: '#111827' }}
                                    />
                                </div>
                            )}

                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Duration (Optional)</label>
                                <input 
                                    type="text" 
                                    value={newVideo.duration}
                                    onChange={e => setNewVideo({...newVideo, duration: e.target.value})}
                                    placeholder="e.g. 5:30"
                                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', background: 'white', color: '#111827' }}
                                />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#374151', marginBottom: '6px' }}>Description (Optional)</label>
                                <textarea 
                                    value={newVideo.description}
                                    onChange={e => setNewVideo({...newVideo, description: e.target.value})}
                                    placeholder="Add a description that patients will see..."
                                    style={{ width: '100%', padding: '10px 14px', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', boxSizing: 'border-box', background: 'white', color: '#111827', minHeight: '80px', fontFamily: 'inherit', resize: 'vertical' }}
                                />
                            </div>
                            
                            <button 
                                onClick={handleUploadVideo}
                                disabled={isUploading}
                                style={{ width: '100%', padding: '12px', background: isUploading ? 'var(--primary-300)' : 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '700', cursor: isUploading ? 'not-allowed' : 'pointer', marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', transition: 'all 0.2s' }}
                            >
                                {isUploading ? (
                                    <>
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" style={{ animation: 'spin 1s linear infinite' }}>
                                            <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
                                        </svg>
                                        Saving...
                                    </>
                                ) : "Save Content"}
                            </button>
                            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
                        </div>
                    </div>
                </div>
            )}

            {/* MANAGE CONTENT MODAL */}
            {showManageModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
                    <div style={{ background: 'white', borderRadius: '16px', padding: '32px', width: '90%', maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#111827' }}>Manage Program Content</h3>
                            <button onClick={() => setShowManageModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        {isFetchingVideos ? (
                            <p>Loading videos...</p>
                        ) : programVideos.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px', background: '#f8fafc', borderRadius: '12px' }}>
                                <p style={{ color: '#64748b' }}>No videos in this program yet.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {programVideos.map(vid => (
                                    <div key={vid._id} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px' }}>
                                        {editingVideo && editingVideo._id === vid._id ? (
                                            // Edit Form
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                <input 
                                                    value={editingVideo.title}
                                                    onChange={e => setEditingVideo({...editingVideo, title: e.target.value})}
                                                    style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                                                />
                                                <input 
                                                    value={editingVideo.duration}
                                                    placeholder="Duration"
                                                    onChange={e => setEditingVideo({...editingVideo, duration: e.target.value})}
                                                    style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                                                />
                                                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                                    <button onClick={saveEditedVideo} style={{ background: '#10b981', color: 'white', border: 'none', padding: '6px 16px', borderRadius: '6px', cursor: 'pointer' }}>Save</button>
                                                    <button onClick={() => setEditingVideo(null)} style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '6px 16px', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                                                </div>
                                            </div>
                                        ) : (
                                            // View Mode
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div>
                                                    <h4 style={{ margin: '0 0 4px', fontSize: '16px', color: '#0f172a' }}>{vid.title}</h4>
                                                    <div style={{ display: 'flex', gap: '12px', fontSize: '13px', color: '#64748b' }}>
                                                        <span>{vid.duration || '0:00'}</span>
                                                        <span>•</span>
                                                        <a href={vid.url.startsWith('/') ? `${BACKEND_URL}${vid.url}` : vid.url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }}>View Video</a>
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button 
                                                        onClick={() => startEditingVideo(vid)}
                                                        style={{ background: '#f1f5f9', color: '#475569', border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer' }}
                                                    >
                                                        Edit
                                                    </button>
                                                    <button 
                                                        onClick={() => handleDeleteVideo(vid._id)}
                                                        style={{ background: '#fef2f2', color: '#ef4444', border: 'none', padding: '8px', borderRadius: '6px', cursor: 'pointer' }}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

        {/* VIEW PATIENTS MODAL */}
        {showPatientsModal && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
                <div style={{ background: 'white', borderRadius: '16px', padding: '32px', width: '90%', maxWidth: '500px', maxHeight: '80vh', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                        <h3 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#111827' }}>Enrolled Patients</h3>
                        <button onClick={() => setShowPatientsModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                    </div>

                    {isFetchingPatients ? (
                        <p style={{ textAlign: 'center', color: '#64748b' }}>Loading patients...</p>
                    ) : programPatients.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', background: '#f8fafc', borderRadius: '12px' }}>
                            <p style={{ color: '#64748b' }}>No patients enrolled yet.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {programPatients.map(patient => (
                                <div key={patient._id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', border: '1px solid #e2e8f0', borderRadius: '12px' }}>
                                    <img 
                                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(patient.name)}&background=random`} 
                                        alt={patient.name} 
                                        style={{ width: '40px', height: '40px', borderRadius: '50%' }}
                                    />
                                    <div>
                                        <h4 style={{ margin: '0 0 2px', fontSize: '15px', color: '#0f172a' }}>{patient.name}</h4>
                                        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>{patient.email}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )}

            {/* MANAGE GENERAL VIDEOS MODAL */}
            {showManageGeneralModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
                    <div style={{ background: 'white', borderRadius: '16px', padding: '32px', width: '90%', maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                            <div>
                                <h3 style={{ margin: '0 0 4px', fontSize: '20px', fontWeight: '700', color: '#111827' }}>Manage General Videos</h3>
                                <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}>Edit or remove videos visible to all patients.</p>
                            </div>
                            <button onClick={() => { setShowManageGeneralModal(false); setEditingGeneralVideo(null); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280' }}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </div>

                        {isFetchingGeneral ? (
                            <p style={{ textAlign: 'center', color: '#64748b' }}>Loading videos...</p>
                        ) : generalVideos.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px', background: '#f8fafc', borderRadius: '12px' }}>
                                <p style={{ color: '#64748b' }}>No general videos uploaded yet.</p>
                                <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '6px' }}>Use "Upload General Video" to add your first one.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {generalVideos.map(vid => (
                                    <div key={vid._id} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden' }}>
                                        {/* Thumbnail strip */}
                                        {vid.thumbnail && (
                                            <img 
                                                src={vid.thumbnail.startsWith('http') || vid.thumbnail.startsWith('data:') ? vid.thumbnail : `${BACKEND_URL}${vid.thumbnail}`}
                                                alt={vid.title}
                                                style={{ width: '100%', height: '120px', objectFit: 'cover' }}
                                            />
                                        )}
                                        <div style={{ padding: '16px' }}>
                                            {editingGeneralVideo && editingGeneralVideo._id === vid._id ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                    <input 
                                                        value={editingGeneralVideo.title}
                                                        onChange={e => setEditingGeneralVideo({...editingGeneralVideo, title: e.target.value})}
                                                        placeholder="Title"
                                                        style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px' }}
                                                    />
                                                    <input 
                                                        value={editingGeneralVideo.description || ''}
                                                        onChange={e => setEditingGeneralVideo({...editingGeneralVideo, description: e.target.value})}
                                                        placeholder="Description (optional)"
                                                        style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px' }}
                                                    />
                                                    <input 
                                                        value={editingGeneralVideo.duration || ''}
                                                        onChange={e => setEditingGeneralVideo({...editingGeneralVideo, duration: e.target.value})}
                                                        placeholder="Duration (e.g. 5:30)"
                                                        style={{ padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px' }}
                                                    />
                                                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                                                        <button onClick={saveEditedGeneralVideo} style={{ background: '#10b981', color: 'white', border: 'none', padding: '8px 18px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>Save</button>
                                                        <button onClick={() => setEditingGeneralVideo(null)} style={{ background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', padding: '8px 18px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
                                                        <h4 style={{ margin: '0 0 4px', fontSize: '15px', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{vid.title}</h4>
                                                        <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#64748b', flexWrap: 'wrap' }}>
                                                            {vid.duration && <span>⏱ {vid.duration}</span>}
                                                            <a href={vid.url.startsWith('/') ? `${BACKEND_URL}${vid.url}` : vid.url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none' }}>▶ View</a>
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '8px', marginLeft: '12px', flexShrink: 0 }}>
                                                        <button 
                                                            onClick={() => setEditingGeneralVideo({ ...vid })}
                                                            style={{ background: '#f1f5f9', color: '#475569', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
                                                        >
                                                            Edit
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteGeneralVideo(vid._id)}
                                                            style={{ background: '#fef2f2', color: '#ef4444', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

        </div>
    );
}

export default DoctorPrograms;
