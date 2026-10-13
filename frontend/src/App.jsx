import { BrowserRouter, Routes, Route } from "react-router-dom";
import VideoDetail from "./pages/VideoDetail";
import DoctorLogin from "./pages/doctor/DoctorLogin";
import DoctorSignUp from "./pages/doctor/DoctorSignUp";
import Welcome from "./pages/Welcome";
import PatientLogin from "./pages/PatientLogin";
import PatientSignUp from "./pages/PatientSignUp";
import ArticleDetail from "./pages/ArticleDetail";
import Home from "./pages/Home";
import AppointmentsPage from "./pages/AppointmentsPage";
import Videos from "./pages/Videos";
import Articles from "./pages/Articles";
import DoctorDashboard from "./pages/doctor/DoctorDashboard";
import DoctorAppointments from "./pages/doctor/DoctorAppointments";
import DoctorPrograms from "./pages/doctor/DoctorPrograms";
import DoctorReports from "./pages/doctor/DoctorReports";
import DoctorArticles from "./pages/doctor/DoctorArticles";
import DoctorNewArticle from "./pages/doctor/DoctorNewArticle";
import { OurTeamPatient, OurTeamDoctor } from "./pages/OurTeam";
import VerifyEmail from "./pages/VerifyEmail";
import PatientOnboarding from "./pages/PatientOnboarding";
import DoctorOnboarding from "./pages/doctor/DoctorOnboarding";
import PatientReports from "./pages/PatientReports";
import GoogleAuthSuccess, { GoogleAuthError } from "./pages/GoogleAuthSuccess";
import OtpVerification from "./pages/OtpVerification";
import ForgotPassword from "./pages/ForgotPassword";
import RequireAuth from "./components/RequireAuth";
import ChatAssistant from "./components/ChatAssistant";

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Existing Pages */}
        <Route path="/" element={<Welcome />} />
        <Route path="/patient" element={<PatientLogin />} />
        <Route path="/patient/signup" element={<PatientSignUp />} />
        <Route path="/patient/onboarding" element={<RequireAuth role="patient"><PatientOnboarding /></RequireAuth>} />

        {/* Dashboard Pages */}
        <Route path="/dashboard" element={<RequireAuth role="patient"><Home /></RequireAuth>} />
        <Route path="/appointments" element={<RequireAuth role="patient"><AppointmentsPage /></RequireAuth>} />
        <Route path="/videos" element={<RequireAuth role="patient"><Videos /></RequireAuth>} />
        <Route path="/articles" element={<RequireAuth role="patient"><Articles /></RequireAuth>} />
        <Route path="/reports" element={<RequireAuth role="patient"><PatientReports /></RequireAuth>} />
        <Route path="/article" element={<RequireAuth role="any"><ArticleDetail /></RequireAuth>} />
        <Route path="/video" element={<RequireAuth role="any"><VideoDetail /></RequireAuth>} />
        <Route path="/physiotherapist" element={<DoctorLogin />} />
        <Route path="/doctor/login" element={<DoctorLogin />} />
        <Route path="/doctor/signup" element={<DoctorSignUp />} />
        <Route path="/doctor/onboarding" element={<RequireAuth role="doctor"><DoctorOnboarding /></RequireAuth>} />
        <Route path="/doctor/dashboard" element={<RequireAuth role="doctor"><DoctorDashboard /></RequireAuth>} />
        <Route path="/doctor/appointments" element={<RequireAuth role="doctor"><DoctorAppointments /></RequireAuth>} />
        <Route path="/doctor/programs" element={<RequireAuth role="doctor"><DoctorPrograms /></RequireAuth>} />
        <Route path="/doctor/reports" element={<RequireAuth role="doctor"><DoctorReports /></RequireAuth>} />
        <Route path="/doctor/articles" element={<RequireAuth role="doctor"><DoctorArticles /></RequireAuth>} />
        <Route path="/doctor/articles/new" element={<RequireAuth role="doctor"><DoctorNewArticle /></RequireAuth>} />
        <Route path="/our-team" element={<RequireAuth role="patient"><OurTeamPatient /></RequireAuth>} />
        <Route path="/doctor/our-team" element={<RequireAuth role="doctor"><OurTeamDoctor /></RequireAuth>} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/verify-otp" element={<OtpVerification />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* Unknown URL → home */}
        <Route path="*" element={<Welcome />} />

        {/* Google OAuth result pages */}
        <Route path="/auth/google/success" element={<GoogleAuthSuccess />} />
        <Route path="/auth/google/error" element={<GoogleAuthError />} />

      </Routes>
      <ChatAssistant />
    </BrowserRouter>
  );
}

export default App;