import express from "express";
import protect from "../middleware/auth.middleware.js";
import { createSession, revokeSession, streamMedia } from "../controllers/playback-session.controller.js";
import { validatePlaybackSessionBody, validatePlaybackSessionId } from "../middleware/validate.middleware.js";

const router = express.Router();

router.post("/sessions", protect, validatePlaybackSessionBody, createSession);
router.get("/sessions/:sessionId/media", streamMedia);
router.head("/sessions/:sessionId/media", streamMedia);
router.delete("/sessions/:sessionId", protect, validatePlaybackSessionId, revokeSession);

export default router;
