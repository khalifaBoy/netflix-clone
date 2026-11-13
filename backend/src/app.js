import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "../routes/auth.routes.js";
import profileRoutes from "../routes/profile.routes.js";
import movieRoutes from "../routes/movie.routes.js";
import watchlistRoutes from "../routes/watchlist.routes.js";
import recommendationRoutes from "../routes/recommendation.routes.js";
import { errorHandler } from "../middleware/error.middleware.js";
import path from "path";
import { fileURLToPath } from "url";
const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(cors({
  origin: "*"
}));

app.use(express.json({ limit: "100kb" }));

app.use(express.urlencoded({ extended: true, limit: "100kb", parameterLimit: 100 }));
app.use(cookieParser());

app.use("/api/auth", authRoutes);
app.use("/api/profiles", profileRoutes);
app.use("/api/movies", movieRoutes);
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use("/api/watchlist", watchlistRoutes);
app.use("/api/recommendations", recommendationRoutes);

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
