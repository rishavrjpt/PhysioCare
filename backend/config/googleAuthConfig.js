import "dotenv/config";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/User.js";


/**
 * Google OAuth Strategy
 * - `passReqToCallback: true` lets us read req.query.state to know
 *   which role (patient / doctor) is being requested.
 * - On first login, we create a new user with the role from `state`.
 * - On subsequent logins, we verify the stored role matches the portal.
 */
export const isGoogleConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

// Without credentials GoogleStrategy throws at startup and crashes the whole server,
// so only register it when it is configured.
if (isGoogleConfigured) passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.BACKEND_URL || "http://localhost:8080"}/api/auth/google/callback`,
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        // Role is carried in the OAuth `state` param (set when initiating)
        const role = req.query.state === "doctor" ? "doctor" : "patient";

        let user = await User.findOne({ googleId: profile.id });

        if (user) {
          // Existing Google user — enforce role match
          const allowedRoles = role === "doctor" ? ["doctor", "admin"] : ["patient"];
          if (!allowedRoles.includes(user.role)) {
            const correctPortal = role === "doctor" ? "Patient" : "Physiotherapist";
            return done(null, false, {
              message: `Wrong portal. Please use the ${correctPortal} login.`,
              wrongRole: true,
              role: user.role,
            });
          }
          return done(null, user);
        }

        // Check if an email-based account already exists
        const email = profile.emails?.[0]?.value?.toLowerCase().trim();
        if (!email) {
          return done(null, false, { message: "Your Google account has no email address." });
        }
        const existingEmailUser = await User.findOne({ email });
        if (existingEmailUser) {
          // Link Google account to existing email user
          const allowedRoles = role === "doctor" ? ["doctor", "admin"] : ["patient"];
          if (!allowedRoles.includes(existingEmailUser.role)) {
            const correctPortal =
              role === "doctor" ? "Patient" : "Physiotherapist";
            return done(null, false, {
              message: `Wrong portal. Please use the ${correctPortal} login.`,
              wrongRole: true,
              role: existingEmailUser.role,
            });
          }
          // If the email account was never verified, someone else may have registered it
          // with a password they know. Google has proven ownership, so drop that password.
          if (!existingEmailUser.isVerified) {
            existingEmailUser.password = null;
            existingEmailUser.isVerified = true;
          }
          existingEmailUser.googleId = profile.id;
          existingEmailUser.authProvider = "google";
          if (!existingEmailUser.profilePhoto && profile.photos?.[0]?.value) {
            existingEmailUser.profilePhoto = profile.photos[0].value;
          }
          await existingEmailUser.save();
          return done(null, existingEmailUser);
        }

        // Create brand-new Google user
        const newUser = await User.create({
          name: profile.displayName,
          email,
          googleId: profile.id,
          authProvider: "google",
          role,
          isVerified: true, // Google accounts are pre-verified
          profileCompleted: false,
          profilePhoto: profile.photos?.[0]?.value || "",
        });

        return done(null, newUser);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);

// Minimal serialize/deserialize (we use JWT, not sessions — these are stubs)
passport.serializeUser((user, done) => done(null, user._id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

export default passport;
