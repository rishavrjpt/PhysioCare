import { useNavigate } from "react-router-dom";
import hero from "../assets/hero.jpg";

function Home() {
  const navigate = useNavigate();

  return (
    <div className="home-container">
      <div className="card">
        {/* LEFT SIDE */}
        <div className="left">
          <img src={hero} alt="Physio" />
          <div className="left-overlay">
            <h2>
              Personalized Recovery <br />
              <span>Starts Here</span>
            </h2>
            <p>
              Connect with expert physiotherapists and follow plans tailored
              specifically for your body.
            </p>
          </div>
        </div>

        {/* RIGHT SIDE */}
        <div className="right">
          <h4>Welcome to PhysioCare</h4>
          <h1>
            Find the perfect <br />
            <span>Physiotherapist</span>
          </h1>

          <p>
            Book expert physiotherapists at home, access resources to support
            your health journey.
          </p>

          <button
            className="btn primary"
            onClick={() => navigate("/patient")}
          >
            Patient →
          </button>

          <button
            className="btn outline"
            onClick={() => navigate("/physiotherapist")}
          >
            Physiotherapist →
          </button>


        </div>
      </div>
    </div>
  );
}

export default Home;