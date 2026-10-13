import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { installAuthFetch } from "./utils/auth";

import "./index.css";
import "./style/welcome.css";
import "./style/patientLogin.css";

// Attach the login token to every API request (must run before the app renders).
installAuthFetch();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
