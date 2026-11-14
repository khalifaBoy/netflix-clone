import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "../routes/auth.routes.js";
import profileRoutes from "../routes/profile.routes.js";
import movieRoutes from "../routes/movie.routes.js";
import watchlistRoutes from "../routes/watchlist.routes.js";
import recommendationRoutes from "../routes/recommendation.routes.js";
import watchHistoryRoutes from "../routes/watch-history.routes.js";
import playbackRoutes from "../routes/playback.routes.js";
import { errorHandler, errorResponseContract } from "../middleware/error.middleware.js";
import requestLogger from "../middleware/request-logger.middleware.js";
import { createCorsOptions } from "../config/cors.js";
import path from "path";
import { fileURLToPath } from "url";
const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(requestLogger);
app.use(cors(createCorsOptions()));

app.use(express.json({ limit: "100kb" }));

app.use(express.urlencoded({ extended: true, limit: "100kb", parameterLimit: 100 }));
app.use(cookieParser());
app.use(errorResponseContract);

app.use("/api/auth", authRoutes);
app.use("/api/profiles", profileRoutes);
app.use("/api/movies", movieRoutes);
app.use("/uploads", (req, res, next) => {
  let decodedPath = req.path;
  try {
    // Decode repeatedly so values that static serving would decode in a later
    // layer (for example, double-encoded separators or dot segments) are
    // classified before they reach express.static.
    for (let pass = 0; pass < 8; pass += 1) {
      const nextPath = decodeURIComponent(decodedPath);
      if (nextPath === decodedPath) break;
      decodedPath = nextPath;
    }
    decodedPath = decodedPath.replace(/\\/g, "/");
  } catch {
    return res.status(400).json({ success: false, message: "Invalid asset path" });
  }

  // Normalize before checking so encoded separators and dot segments cannot
  // reach the video directory through the public static mount.
  const normalizedPath = path.posix.normalize(`/${decodedPath}`);
  if (normalizedPath.split("/")[1]?.toLowerCase() === "videos") {
    return res.status(404).json({ success: false, message: "Asset not found" });
  }

  return next();
}, express.static(path.join(__dirname, "../uploads")));
app.use("/api/watchlist", watchlistRoutes);
app.use("/api/recommendations", recommendationRoutes);
app.use("/api/watch-history", watchHistoryRoutes);
app.use("/api/playback", playbackRoutes);

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Netflix backend is running",
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

app.use(errorHandler);

export default app;
