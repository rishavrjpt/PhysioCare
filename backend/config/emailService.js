// EmailJS REST API — called from the backend with a private access token.
// Docs: https://www.emailjs.com/docs/rest-api/send/
// In the EmailJS dashboard: Account → Security → enable "Allow EmailJS API for non-browser applications".
import { isProduction } from "./env.js";

export const isEmailConfigured = () =>
  Boolean(
    process.env.EMAILJS_SERVICE_ID &&
    process.env.EMAILJS_TEMPLATE_ID &&
    process.env.EMAILJS_PUBLIC_KEY &&
    process.env.EMAILJS_PRIVATE_KEY &&
    !process.env.EMAILJS_PRIVATE_KEY.includes("your_private_key")
  );

/**
 * Send OTP email via EmailJS REST API.
 * Template variables used: {{to_name}}, {{to_email}}, {{otp}}
 */
export const sendOtpEmail = async (toEmail, toName, otp) => {
  if (!isEmailConfigured()) {
    // Production must never print an OTP: fail so the caller returns a delivery error instead.
    if (isProduction()) {
      throw new Error("EmailJS is not configured on this server");
    }
    // Local development without email: print the OTP prominently
    console.log("\n========================================================");
    console.log(`🔑 [DEV OTP] Code for ${toEmail}: >>> ${otp} <<<`);
    console.log("========================================================\n");
    return true;
  }

  try {
    const response = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: process.env.EMAILJS_SERVICE_ID,
        template_id: process.env.EMAILJS_TEMPLATE_ID,
        user_id: process.env.EMAILJS_PUBLIC_KEY,
        accessToken: process.env.EMAILJS_PRIVATE_KEY,
        template_params: { to_name: toName || "User", to_email: toEmail, email: toEmail, otp },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`EmailJS error ${response.status}: ${text}`);
    }
    console.log(`OTP email sent to ${toEmail}`);
    return true;
  } catch (err) {
    if (!isProduction()) {
      console.log("\n========================================================");
      console.log(`🔑 [DEV OTP FALLBACK] Code for ${toEmail}: >>> ${otp} <<<`);
      console.log(`(EmailJS attempt failed: ${err.message})`);
      console.log("========================================================\n");
      return true;
    }
    throw err;
  }
};
