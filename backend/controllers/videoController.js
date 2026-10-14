import { one, many, FOREIGN_KEY_VIOLATION } from "../config/pg.js";
import { camelize, isUuid } from "../utils/rows.js";
import { insertRow, updateBy } from "../utils/sql.js";
import { BUCKETS, uploadBuffer, storeImageIfInline, deleteStoredFile, fileExt } from "../config/storage.js";

const serverError = (res, label, error) => {
    console.error(`${label}:`, error);
    res.status(500).json({ msg: "Server error" });
};

const isHttpUrl = (value) => /^https?:\/\/\S+$/i.test(String(value || "").trim());

const LIST_COLUMNS = "v.id, v.doctor_id, v.program_id, v.title, v.description, v.url, v.thumbnail, v.duration, v.created_at";

// A list row joined with the doctor's name, in the old populated shape: doctorId = { _id, name }.
const withDoctor = (row) => {
    const { doctorName, ...video } = camelize(row);
    return { ...video, doctorId: { _id: video.doctorId, name: doctorName } };
};

// Loads a video and checks the logged-in doctor owns it.
const loadOwnVideo = async (req, res) => {
    const video = camelize(await one("select * from videos where id = $1", [req.params.id]));
    if (!video) {
        res.status(404).json({ msg: "Video not found" });
        return null;
    }
    if (req.user.role !== "admin" && video.doctorId !== req.user.id) {
        res.status(403).json({ msg: "This is not your video." });
        return null;
    }
    return video;
};

// Upload a new video (file or link)
export const createVideo = async (req, res) => {
    const stored = []; // URLs uploaded during this request, removed again if anything fails
    const cleanupUpload = () => Promise.all(stored.map(deleteStoredFile));
    try {
        const { programId, title, description, duration, thumbnail } = req.body;

        let url = "";
        if (req.file) {
            url = "pending-upload"; // replaced by the Storage URL after validation below
        } else if (req.body.url) {
            if (!isHttpUrl(req.body.url)) {
                return res.status(400).json({ msg: "Video link must start with http:// or https://" });
            }
            url = req.body.url.trim();
        }

        if (!title?.trim() || !url) {
            return res.status(400).json({ msg: "Title and Video File/URL are required." });
        }

        // A doctor can only attach videos to their own program
        if (programId) {
            const program = isUuid(programId) ? await one("select doctor_id from programs where id = $1", [programId]) : null;
            if (!program || (req.user.role !== "admin" && program.doctor_id !== req.user.id)) {
                return res.status(403).json({ msg: "Program not found in your programs." });
            }
        }

        // Thumbnail: only allow http(s) links or inline images, never javascript: etc.
        let safeThumbnail =
            thumbnail && (isHttpUrl(thumbnail) || String(thumbnail).startsWith("data:image/")) ? thumbnail : undefined;

        // Everything is valid - now move the files to Supabase Storage
        if (req.file) {
            url = await uploadBuffer({
                bucket: BUCKETS.videos,
                folder: req.user.id,
                buffer: req.file.buffer,
                contentType: req.file.mimetype,
                ext: fileExt(req.file.originalname),
            });
            stored.push(url);
        }
        if (safeThumbnail && safeThumbnail.startsWith("data:image/")) {
            safeThumbnail = (await storeImageIfInline(safeThumbnail, "thumbnails")) || undefined;
            if (safeThumbnail) stored.push(safeThumbnail);
        }

        const row = await insertRow("videos", {
            doctorId: req.user.id, // always the logged-in doctor
            programId: programId || null, // null means general
            title: title.trim(),
            description: description ?? null,
            url,
            duration: duration ? String(duration) : undefined,
            thumbnail: safeThumbnail,
        });

        res.status(201).json(camelize(row));
    } catch (error) {
        await cleanupUpload();
        serverError(res, "Error creating video", error);
    }
};

// Update video details (title, description, duration) without replacing the file
export const updateVideo = async (req, res) => {
    try {
        const video = await loadOwnVideo(req, res);
        if (!video) return;

        const { title, description, duration } = req.body;
        if (title !== undefined && !String(title).trim()) {
            return res.status(400).json({ msg: "Title cannot be empty." });
        }
        const row = await updateBy("videos", "id", video._id, {
            title: title !== undefined ? String(title).trim() : undefined,
            description: description === undefined ? undefined : description ?? null,
            duration: duration === undefined ? undefined : String(duration ?? ""),
        });

        res.status(200).json(camelize(row));
    } catch (error) {
        serverError(res, "Error updating video", error);
    }
};

// Delete a single video (and its file, if uploaded)
export const deleteVideo = async (req, res) => {
    try {
        const video = await loadOwnVideo(req, res);
        if (!video) return;

        await one("delete from videos where id = $1 returning id", [video._id]);
        await Promise.all([deleteStoredFile(video.url), deleteStoredFile(video.thumbnail)]);

        res.status(200).json({ msg: "Video deleted successfully" });
    } catch (error) {
        serverError(res, "Error deleting video", error);
    }
};

// Get general videos (public library)
export const getGeneralVideos = async (req, res) => {
    try {
        const rows = await many(
            `select ${LIST_COLUMNS}, u.name as doctor_name
               from videos v join users u on u.id = v.doctor_id
              where v.program_id is null order by v.created_at desc`
        );
        const videos = rows.map(withDoctor);

        // Show one video per doctor first for variety, then the rest chronologically
        const doctorFirstVideos = new Map();
        const remainingVideos = [];
        for (const video of videos) {
            const docId = video.doctorId._id;
            if (!doctorFirstVideos.has(docId)) doctorFirstVideos.set(docId, video);
            else remainingVideos.push(video);
        }

        res.status(200).json([...doctorFirstVideos.values(), ...remainingVideos]);
    } catch (error) {
        serverError(res, "Error fetching general videos", error);
    }
};

// Get videos for a specific program - only its doctor or an enrolled patient
export const getProgramVideos = async (req, res) => {
    try {
        const { programId } = req.params;
        const program = await one("select doctor_id from programs where id = $1", [programId]);
        if (!program) return res.status(404).json({ msg: "Program not found" });

        const me = req.user;
        let allowed = me.role === "admin" || program.doctor_id === me.id;
        if (!allowed && me.role === "patient") {
            allowed = Boolean(await one(
                "select 1 from program_enrollments where patient_id = $1 and program_id = $2", [me.id, programId]
            ));
        }
        if (!allowed) return res.status(403).json({ msg: "Enroll in this program to see its videos." });

        const rows = await many(
            `select ${LIST_COLUMNS}, u.name as doctor_name
               from videos v join users u on u.id = v.doctor_id
              where v.program_id = $1 order by v.created_at desc`,
            [programId]
        );
        res.status(200).json(rows.map(withDoctor));
    } catch (error) {
        serverError(res, "Error fetching program videos", error);
    }
};

// Get general videos uploaded by a specific doctor
export const getGeneralVideosByDoctor = async (req, res) => {
    try {
        const rows = await many(
            `select ${LIST_COLUMNS} from videos v
              where v.doctor_id = $1 and v.program_id is null order by v.created_at desc`,
            [req.params.doctorId]
        );
        res.status(200).json(rows.map(camelize));
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
        if (videoId && !isUuid(videoId)) {
            return res.status(400).json({ msg: "Invalid videoId" });
        }

        let row;
        try {
            row = await insertRow("session_logs", {
                patientId: req.user.id, // always the logged-in patient
                videoId: videoId || null,
                painLevel: Math.round(painLevel),
            });
        } catch (err) {
            if (err.code === FOREIGN_KEY_VIOLATION) return res.status(400).json({ msg: "Invalid videoId" });
            throw err;
        }

        res.status(201).json({ msg: "Session logged successfully", log: camelize(row) });
    } catch (error) {
        serverError(res, "Error logging session", error);
    }
};
