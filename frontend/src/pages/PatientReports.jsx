import { useState, useEffect } from "react";
import { decodeToken } from "../utils/auth";
import Layout from "../components/Layout";
import { API_BASE_URL } from "../config";

function PatientReports() {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchReports = async () => {
            const token = localStorage.getItem("patientToken");
            if (!token) { setLoading(false); return; }
            try {
                const payload = decodeToken(token);
                const res = await fetch(`${API_BASE_URL}/appointments/patient/${payload.id}`);
                if (res.ok) {
                    const data = await res.json();
                    const sentReports = data.filter(a => a.sentToPatient === true && a.status === "Completed");
                    sentReports.sort((a, b) => new Date(b.date) - new Date(a.date));
                    setReports(sentReports);
                }
            } catch (e) {
                console.error("Error fetching reports:", e);
            } finally {
                setLoading(false);
            }
        };
        fetchReports();
    }, []);

    const handlePrint = (report) => {
        const doctorName = report.doctorId?.name || "Your Doctor";
        const sessionDate = new Date(report.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
        const followUpDate = report.followUpDate
            ? new Date(report.followUpDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
            : null;
        const reportId = report._id ? `PC-RPT-${report._id.slice(-8).toUpperCase()}` : `PC-RPT-${Date.now().toString().slice(-8)}`;

        const feelingClass = report.patientFeeling?.toLowerCase() === 'better'
            ? 'better'
            : report.patientFeeling?.toLowerCase() === 'worse'
                ? 'worse'
                : 'same';

        const printContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>Clinical Evaluation Report — Session ${report.sessionNumber || '1'} — PhysioCare</title>
                <style>
                    @page {
                        size: A4 portrait;
                        margin: 12mm 14mm 14mm 14mm;
                    }
                    * {
                        margin: 0;
                        padding: 0;
                        box-sizing: border-box;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                        background: #ffffff;
                        color: #0f172a;
                        padding: 24px;
                        max-width: 820px;
                        margin: 0 auto;
                        line-height: 1.5;
                    }
                    .top-accent-bar {
                        height: 6px;
                        background: linear-gradient(90deg, #0d9488 0%, #06b6d4 100%);
                        border-radius: 4px;
                        margin-bottom: 22px;
                    }
                    .letterhead {
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-start;
                        padding-bottom: 20px;
                        border-bottom: 2px solid #e2e8f0;
                        margin-bottom: 20px;
                    }
                    .clinic-brand {
                        display: flex;
                        align-items: center;
                        gap: 14px;
                    }
                    .clinic-logo-icon {
                        width: 48px;
                        height: 48px;
                        border-radius: 12px;
                        background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    .clinic-info h1 {
                        font-size: 24px;
                        font-weight: 800;
                        color: #0f766e;
                        letter-spacing: -0.5px;
                        margin: 0;
                        line-height: 1.1;
                    }
                    .clinic-info p {
                        font-size: 11px;
                        font-weight: 700;
                        color: #06b6d4;
                        text-transform: uppercase;
                        letter-spacing: 0.6px;
                        margin-top: 4px;
                    }
                    .report-badge-col {
                        text-align: right;
                    }
                    .official-badge {
                        display: inline-block;
                        background: #ccfbf1;
                        color: #0f766e;
                        font-size: 11px;
                        font-weight: 800;
                        padding: 4px 12px;
                        border-radius: 20px;
                        border: 1px solid #99f6e4;
                        letter-spacing: 0.5px;
                        text-transform: uppercase;
                        margin-bottom: 6px;
                    }
                    .report-ref {
                        font-size: 12px;
                        color: #64748b;
                        font-weight: 500;
                    }
                    .meta-card {
                        background: #f8fafc;
                        border: 1px solid #e2e8f0;
                        border-radius: 12px;
                        padding: 16px 20px;
                        display: grid;
                        grid-template-columns: repeat(3, 1fr);
                        gap: 16px;
                        margin-bottom: 20px;
                    }
                    .meta-item label {
                        display: block;
                        font-size: 10px;
                        font-weight: 700;
                        color: #64748b;
                        text-transform: uppercase;
                        letter-spacing: 0.5px;
                        margin-bottom: 3px;
                    }
                    .meta-item .val {
                        font-size: 14px;
                        font-weight: 700;
                        color: #0f172a;
                    }
                    .meta-item .sub {
                        font-size: 12px;
                        color: #0d9488;
                        font-weight: 600;
                    }
                    .section-card {
                        background: #ffffff;
                        border: 1px solid #e2e8f0;
                        border-left: 4px solid #0d9488;
                        border-radius: 10px;
                        padding: 16px 20px;
                        margin-bottom: 14px;
                    }
                    .section-header {
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        margin-bottom: 8px;
                    }
                    .section-title-wrap {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }
                    .section-title {
                        font-size: 12px;
                        font-weight: 800;
                        color: #0f766e;
                        text-transform: uppercase;
                        letter-spacing: 0.6px;
                    }
                    .feeling-pill {
                        font-size: 11px;
                        font-weight: 700;
                        padding: 3px 10px;
                        border-radius: 6px;
                        text-transform: capitalize;
                    }
                    .feeling-pill.better { background: #dcfce7; color: #15803d; }
                    .feeling-pill.worse { background: #fee2e2; color: #b91c1c; }
                    .feeling-pill.same { background: #f1f5f9; color: #475569; }
                    .section-body {
                        font-size: 14px;
                        color: #1e293b;
                        line-height: 1.6;
                    }
                    .program-box {
                        background: #f0fdfa;
                        border: 1px solid #a7f3d0;
                        border-radius: 10px;
                        padding: 14px 18px;
                        display: flex;
                        align-items: center;
                        gap: 14px;
                        margin-bottom: 14px;
                    }
                    .prog-icon {
                        width: 38px;
                        height: 38px;
                        border-radius: 8px;
                        background: #0d9488;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        flex-shrink: 0;
                    }
                    .prog-title {
                        font-size: 14px;
                        font-weight: 800;
                        color: #0f766e;
                    }
                    .prog-code {
                        font-size: 12px;
                        color: #0d9488;
                        font-weight: 600;
                    }
                    .followup-card {
                        background: #f8fafc;
                        border: 1px dashed #0d9488;
                        border-radius: 10px;
                        padding: 12px 18px;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        margin-bottom: 20px;
                    }
                    .followup-label {
                        font-size: 13px;
                        font-weight: 700;
                        color: #0f172a;
                    }
                    .followup-date {
                        font-size: 13px;
                        font-weight: 800;
                        color: #0d9488;
                        background: #ccfbf1;
                        padding: 4px 14px;
                        border-radius: 20px;
                    }
                    .signature-section {
                        margin-top: 28px;
                        padding-top: 18px;
                        border-top: 1px solid #e2e8f0;
                        display: flex;
                        justify-content: space-between;
                        align-items: flex-end;
                    }
                    .clinic-stamp {
                        border: 2px dashed #0d9488;
                        border-radius: 8px;
                        padding: 8px 14px;
                        color: #0d9488;
                        text-align: center;
                        font-size: 10px;
                        font-weight: 800;
                        letter-spacing: 0.5px;
                        text-transform: uppercase;
                        line-height: 1.3;
                    }
                    .doctor-signature {
                        text-align: right;
                    }
                    .sig-line {
                        width: 170px;
                        height: 1px;
                        background: #0f172a;
                        margin-bottom: 6px;
                        margin-left: auto;
                    }
                    .doc-name {
                        font-size: 14px;
                        font-weight: 800;
                        color: #0f172a;
                    }
                    .doc-title {
                        font-size: 12px;
                        color: #64748b;
                    }
                    .report-footer {
                        margin-top: 20px;
                        font-size: 11px;
                        color: #94a3b8;
                        display: flex;
                        justify-content: space-between;
                        border-top: 1px solid #f1f5f9;
                        padding-top: 10px;
                    }
                </style>
            </head>
            <body>
                <div class="top-accent-bar"></div>

                <div class="letterhead">
                    <div class="clinic-brand">
                        <div class="clinic-logo-icon">
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                            </svg>
                        </div>
                        <div class="clinic-info">
                            <h1>PhysioCare</h1>
                            <p>Rehabilitation &amp; Clinical Physiotherapy</p>
                        </div>
                    </div>
                    <div class="report-badge-col">
                        <span class="official-badge">Clinical Report &bull; Verified</span>
                        <div class="report-ref">Reference: <strong>${reportId}</strong></div>
                    </div>
                </div>

                <div class="meta-card">
                    <div class="meta-item">
                        <label>Attending Physiotherapist</label>
                        <div class="val">Dr. ${doctorName}</div>
                        <div class="sub">Certified Clinical Physiotherapist</div>
                    </div>
                    <div class="meta-item">
                        <label>Session Details</label>
                        <div class="val">Session ${report.sessionNumber || '1'}</div>
                        <div class="sub">Clinical Evaluation</div>
                    </div>
                    <div class="meta-item">
                        <label>Consultation Date</label>
                        <div class="val">${sessionDate}</div>
                        <div class="sub">Completed Assessment</div>
                    </div>
                </div>

                ${report.problemDescription ? `
                <div class="section-card">
                    <div class="section-header">
                        <div class="section-title-wrap">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0d9488" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                            <span class="section-title">Chief Complaint &amp; Clinical Condition</span>
                        </div>
                        ${report.patientFeeling ? `<span class="feeling-pill ${feelingClass}">Status: ${report.patientFeeling}</span>` : ''}
                    </div>
                    <div class="section-body">${report.problemDescription}</div>
                </div>` : ''}

                ${report.medicine ? `
                <div class="section-card">
                    <div class="section-header">
                        <div class="section-title-wrap">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0d9488" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>
                            <span class="section-title">Prescribed Medication &amp; Pharmacological Support (Rx)</span>
                        </div>
                    </div>
                    <div class="section-body">${report.medicine}</div>
                </div>` : ''}

                ${report.suggestion ? `
                <div class="section-card">
                    <div class="section-header">
                        <div class="section-title-wrap">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#0d9488" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                            <span class="section-title">Physiotherapist's Clinical Guidance &amp; Directives</span>
                        </div>
                    </div>
                    <div class="section-body">${report.suggestion}</div>
                </div>` : ''}

                ${report.programCode ? `
                <div class="program-box">
                    <div class="prog-icon">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                    </div>
                    <div>
                        <div class="prog-title">${report.programTitle || 'Prescribed Exercise Routine'}</div>
                        <div class="prog-code">Assigned Program Code: ${report.programCode} &bull; Practice daily as instructed</div>
                    </div>
                </div>` : ''}

                ${followUpDate ? `
                <div class="followup-card">
                    <span class="followup-label">Next Scheduled Clinical Follow-up:</span>
                    <span class="followup-date">&bull; ${followUpDate}</span>
                </div>` : ''}

                <div class="signature-section">
                    <div class="clinic-stamp">
                        <div>PhysioCare Network</div>
                        <div style="font-size:9px;color:#0f766e;font-weight:600;">Digitally Authenticated</div>
                    </div>
                    <div class="doctor-signature">
                        <div class="sig-line"></div>
                        <div class="doc-name">Dr. ${doctorName}</div>
                        <div class="doc-title">Certified Physiotherapy Practitioner</div>
                    </div>
                </div>

                <div class="report-footer">
                    <span>Generated by PhysioCare Clinical Management System</span>
                    <span>Confidential Medical Document &bull; All Rights Reserved</span>
                </div>
            </body>
            </html>
        `;

        const win = window.open('', '_blank', 'width=840,height=750');
        win.document.write(printContent);
        win.document.close();
        win.focus();
        setTimeout(() => { win.print(); }, 400);
    };

    const feelingColor = (f) => {
        if (f === 'Better') return '#16a34a';
        if (f === 'Worse') return '#dc2626';
        return '#475569';
    };

    return (
        <Layout>
            <div style={{ padding: '32px 0' }}>
                <h1 style={{ fontSize: '32px', fontWeight: '800', color: '#0f172a', marginBottom: '6px' }}>My Reports</h1>
                <p style={{ color: '#64748b', marginBottom: '32px', fontSize: '15px' }}>
                    Clinical reports shared by your physiotherapist. Download any session as a PDF.
                </p>

                {loading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {[1, 2].map(n => (
                            <div key={n} style={{ height: '180px', background: '#f8fafc', borderRadius: '16px', animation: 'shimmer 1.5s infinite' }} />
                        ))}
                    </div>
                ) : reports.length === 0 ? (
                    <div style={{ background: 'white', borderRadius: '16px', padding: '60px 40px', textAlign: 'center', border: '1px solid #e2e8f0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" style={{ margin: '0 auto 16px' }}>
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                        <h3 style={{ fontSize: '18px', fontWeight: '700', color: '#374151', marginBottom: '8px' }}>No reports yet</h3>
                        <p style={{ color: '#9ca3af', fontSize: '14px' }}>Your doctor will share session reports with you after each completed appointment.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {reports.map(report => {
                            const doctorName = report.doctorId?.name || "Your Doctor";
                            const sessionDate = new Date(report.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
                            const followUpDate = report.followUpDate
                                ? new Date(report.followUpDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
                                : null;

                            return (
                                <div key={report._id} style={{ background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                                    {/* Card Header */}
                                    <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, var(--primary-50) 0%, #fafafa 100%)' }}>
                                        <div>
                                            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
                                                Session {report.sessionNumber || '—'}
                                            </h3>
                                            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b', fontWeight: '500' }}>
                                                {sessionDate} &nbsp;·&nbsp; Dr. {doctorName.startsWith('Dr') ? doctorName : 'Dr. ' + doctorName}
                                            </p>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            {report.patientRating && (
                                                <div style={{ background: '#fef3c7', color: '#d97706', padding: '4px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: '700' }}>
                                                    ★ {report.patientRating} / 5
                                                </div>
                                            )}
                                            {report.patientFeeling && (
                                                <span style={{ fontSize: '13px', fontWeight: '600', color: feelingColor(report.patientFeeling), background: report.patientFeeling === 'Better' ? '#dcfce7' : report.patientFeeling === 'Worse' ? '#fee2e2' : '#f1f5f9', padding: '4px 10px', borderRadius: '20px' }}>
                                                    {report.patientFeeling}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Card Body */}
                                    <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                                        <div>
                                            <h5 style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.08em', marginBottom: '12px', fontWeight: '700' }}>Doctor's Clinical Note</h5>
                                            {report.problemDescription && (
                                                <div style={{ marginBottom: '10px' }}>
                                                    <strong style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '2px' }}>Problem</strong>
                                                    <p style={{ margin: 0, fontSize: '14px', color: '#0f172a', lineHeight: '1.5' }}>{report.problemDescription}</p>
                                                </div>
                                            )}
                                            {report.medicine && (
                                                <div style={{ marginBottom: '10px' }}>
                                                    <strong style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '2px' }}>Medicine</strong>
                                                    <p style={{ margin: 0, fontSize: '14px', color: '#0f172a', lineHeight: '1.5' }}>{report.medicine}</p>
                                                </div>
                                            )}
                                            {report.suggestion && (
                                                <div style={{ marginBottom: '10px' }}>
                                                    <strong style={{ display: 'block', fontSize: '12px', color: '#64748b', marginBottom: '2px' }}>Suggestion</strong>
                                                    <p style={{ margin: 0, fontSize: '14px', color: '#0f172a', lineHeight: '1.5' }}>{report.suggestion}</p>
                                                </div>
                                            )}
                                            {followUpDate && (
                                                <div style={{ marginTop: '14px', background: 'var(--primary-50)', padding: '10px 14px', borderRadius: '8px', display: 'inline-block' }}>
                                                    <strong style={{ fontSize: '12px', color: 'var(--primary-hover)' }}>Next Session: </strong>
                                                    <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--primary-900)' }}>{followUpDate}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div style={{ borderLeft: '1px solid #e2e8f0', paddingLeft: '24px' }}>
                                            <h5 style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', letterSpacing: '0.08em', marginBottom: '12px', fontWeight: '700' }}>Your Feedback</h5>
                                            {report.patientReview ? (
                                                <p style={{ fontSize: '14px', color: '#475569', fontStyle: 'italic', lineHeight: '1.7', margin: 0 }}>"{report.patientReview}"</p>
                                            ) : (
                                                <p style={{ fontSize: '13px', color: '#cbd5e1', margin: 0 }}>No review submitted for this session.</p>
                                            )}
                                            {report.programCode && (
                                                <div style={{ marginTop: '16px' }}>
                                                    <strong style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Program Linked</strong>
                                                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--primary)', background: 'var(--primary-50)', padding: '4px 10px', borderRadius: '6px' }}>
                                                        {report.programCode} — {report.programTitle || "Program"}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Card Footer — Download */}
                                    <div style={{ padding: '14px 24px', borderTop: '1px solid #e2e8f0', background: '#fafafa', display: 'flex', justifyContent: 'flex-end' }}>
                                        <button
                                            onClick={() => handlePrint(report)}
                                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 18px', background: 'var(--primary)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', transition: 'background 0.15s' }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--primary-hover)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'var(--primary)'}
                                        >
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                                <polyline points="7 10 12 15 17 10"></polyline>
                                                <line x1="12" y1="15" x2="12" y2="3"></line>
                                            </svg>
                                            Download My Report
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </Layout>
    );
}

export default PatientReports;
