import mongoose from "mongoose";
import Video from "../models/Video.js";
import Program from "../models/Program.js";
import User from "../models/User.js";
import SessionLog from "../models/SessionLog.js";
import { deleteUploadedFile } from "../config/paths.js";

const serverError = (res, label, error) => {
    console.error(`${label}:`, error);
    res.status(500).json({ msg: "Server error" });
};

const isHttpUrl = (value) => /^https?:\/\/\S+$/i.test(String(value || "").trim());

// Loads a video and checks the logged-in doctor owns it.
const loadOwnVideo = async (req, res) => {
    const video = await Video.findById(req.params.id);
    if (!video) {
        res.status(404).json({ msg: "Video not found" });
        return null;
    }
    if (req.user.role !== "admin" && video.doctorId.toString() !== req.user.id) {
        res.status(403).json({ msg: "This is not your video." });
        return null;
    }
    return video;
};

// Upload a new video (file or link)
export const createVideo = async (req, res) => {
    const cleanupUpload = () => req.file && deleteUploadedFile(`/uploads/videos/${req.file.filename}`);
    try {
        const { programId, title, description, duration, thumbnail } = req.body;

        let url = "";
        if (req.file) {
            url = `/uploads/videos/${req.file.filename}`;
        } else if (req.body.url) {
            if (!isHttpUrl(req.body.url)) {
                return res.status(400).json({ msg: "Video link must start with http:// or https://" });
            }
            url = req.body.url.trim();
        }

        if (!title?.trim() || !url) {
            cleanupUpload();
            return res.status(400).json({ msg: "Title and Video File/URL are required." });
        }

        // A doctor can only attach videos to their own program
        if (programId) {
            const program = mongoose.isValidObjectId(programId) ? await Program.findById(programId) : null;
            if (!program || (req.user.role !== "admin" && program.doctorId.toString() !== req.user.id)) {
                cleanupUpload();
                return res.status(403).json({ msg: "Program not found in your programs." });
            }
        }

        // Thumbnail: only allow http(s) links or inline images, never javascript: etc.
        const safeThumbnail =
            thumbnail && (isHttpUrl(thumbnail) || String(thumbnail).startsWith("data:image/")) ? thumbnail : undefined;

        const video = await Video.create({
            doctorId: req.user.id, // always the logged-in doctor
            programId: programId || null, // null means general
            title: title.trim(),
            description,
            url,
            duration,
            thumbnail: safeThumbnail,
        });

        res.status(201).json(video);
    } catch (error) {
        cleanupUpload();
        serverError(res, "Error creating video", error);
    }
};

// Update video details (title, description, duration) without replacing the file
export const updateVideo = async (req, res) => {
    try {
        const video = await loadOwnVideo(req, res);
        if (!video) return;

        const { title, description, duration } = req.body;
        if (title !== undefined) {
            if (!String(title).trim()) return res.status(400).json({ msg: "Title cannot be empty." });
            video.title = String(title).trim();
        }
        if (description !== undefined) video.description = description;
        if (duration !== undefined) video.duration = duration;
        await video.save();

        res.status(200).json(video);
    } catch (error) {
        serverError(res, "Error updating video", error);
    }
};

// Delete a single video (and its file, if uploaded)
export const deleteVideo = async (req, res) => {
    try {
        const video = await loadOwnVideo(req, res);
        if (!video) return;

        deleteUploadedFile(video.url);
        await Video.findByIdAndDelete(video._id);

        res.status(200).json({ msg: "Video deleted successfully" });
    } catch (error) {
        serverError(res, "Error deleting video", error);
    }
};

// Get general videos (public library)
export const getGeneralVideos = async (req, res) => {
    try {
        const videos = await Video.find({ programId: null })
            .select("doctorId programId title description url thumbnail duration createdAt")
            .populate("doctorId", "name")
            .sort({ createdAt: -1 })
            .lean();

        // Show one video per doctor first for variety, then the rest chronologically
        const doctorFirstVideos = new Map();
        const remainingVideos = [];
        for (const video of videos) {
            if (!video.doctorId) {
                remainingVideos.push(video);
                continue;
            }
            const docId = video.doctorId._id.toString();
            if (!doctorFirstVideos.has(docId)) doctorFirstVideos.set(docId, video);
            else remainingVideos.push(video);
        }

        res.status(200).json([...doctorFirstVideos.values(), ...remainingVideos]);
    } catch (error) {
        serverError(res, "Error fetching general videos", error);
    }
};

// Get videos for a specific program — only its doctor or an enrolled patient
export const getProgramVideos = async (req, res) => {
    try {
        const { programId } = req.params;
        const program = await Program.findById(programId).select("doctorId").lean();
        if (!program) return res.status(404).json({ msg: "Program not found" });

        const me = req.user;
        let allowed = me.role === "admin" || program.doctorId.toString() === me.id;
        if (!allowed && me.role === "patient") {
            allowed = Boolean(await User.exists({ _id: me.id, enrolledPrograms: programId }));
        }
        if (!allowed) return res.status(403).json({ msg: "Enroll in this program to see its videos." });

        const videos = await Video.find({ programId })
            .select("doctorId programId title description url thumbnail duration createdAt")
            .populate("doctorId", "name")
            .sort({ createdAt: -1 })
            .lean();
        res.status(200).json(videos);
    } catch (error) {
        serverError(res, "Error fetching program videos", error);
    }
};

// Get general videos uploaded by a specific doctor
export const getGeneralVideosByDoctor = async (req, res) => {
    try {
        const videos = await Video.find({ doctorId: req.params.doctorId, programId: null })
            .select("doctorId programId title description url thumbnail duration createdAt")
            .sort({ createdAt: -1 })
            .lean();
        res.status(200).json(videos);
    } catch (error) {
        serverError(res, "Error fetching general videos by doctor", error);
    }
};

// Log an exercise session (patient)
export const logSession = async (req, res) => {
    try {
        const { videoId } = req.body;
        const painLevel = Number(req.body.painLevel);

        if (!Number.isFinite(painLevel) || painLevel < 1 || painLevel > 10) {
            return res.status(400).json({ msg: "painLevel must be a number from 1 to 10" });
        }
        if (videoId && !mongoose.isValidObjectId(videoId)) {
            return res.status(400).json({ msg: "Invalid videoId" });
        }

        const log = await SessionLog.create({
            patientId: req.user.id, // always the logged-in patient
            videoId: videoId || undefined,
            painLevel,
        });

        res.status(201).json({ msg: "Session logged successfully", log });
    } catch (error) {
        serverError(res, "Error logging session", error);
    }
};
