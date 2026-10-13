import mongoose from "mongoose";

const LOCAL_FALLBACK_URI = "mongodb://127.0.0.1:27017/physiocare";
const isProduction = () => process.env.NODE_ENV === "production";

// Never log the URI itself — it contains the database password.
const safeMessage = (err) =>
  String(err?.message || err).replace(/mongodb(\+srv)?:\/\/\S+/gi, "<mongodb-uri>");

const connectDB = async () => {
  let uri = process.env.MONGO_URI || (isProduction() ? "" : LOCAL_FALLBACK_URI);

  // Local development only: allow the .env.example placeholder to fall back to local MongoDB.
  if (!isProduction() && uri.includes("YOUR_DB_PASSWORD")) {
    console.warn("[MongoDB] MONGO_URI still has a placeholder password. Using local MongoDB:", LOCAL_FALLBACK_URI);
    uri = LOCAL_FALLBACK_URI;
  }

  if (!uri) {
    console.error("[MongoDB] MONGO_URI is not set. Refusing to start in production.");
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("MongoDB Connection Failed:", safeMessage(error));

    // Production must never quietly use a different database — fail loudly instead.
    if (isProduction()) {
      console.error("[MongoDB] Exiting. Check MONGO_URI and Atlas Network Access.");
      process.exit(1);
    }

    // Local development only: fall back to a local MongoDB so the app can still be tried out.
    if (uri !== LOCAL_FALLBACK_URI) {
      console.log(`[MongoDB] Development mode: attempting fallback to local MongoDB (${LOCAL_FALLBACK_URI})...`);
      try {
        const localConn = await mongoose.connect(LOCAL_FALLBACK_URI, {
          serverSelectionTimeoutMS: 3000,
          maxPoolSize: 10,
        });
        console.log(`MongoDB Connected via Local Fallback: ${localConn.connection.host}`);
        return;
      } catch (localErr) {
        console.error("MongoDB Local Fallback also failed:", safeMessage(localErr));
      }
    }
    console.warn("Server will continue running. Check your MONGO_URI in backend/.env.");
  }
};

export default connectDB;
