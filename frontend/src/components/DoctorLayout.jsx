import DoctorSidebar from "./DoctorSidebar";
import "../style/doctor/doctorDashboard.css";

function DoctorLayout({ children }) {
  return (
    <div className="dashboard">
      <DoctorSidebar />
      <div className="main">
        <div className="content">
          {children}
        </div>
      </div>
    </div>
  );
}

export default DoctorLayout;
