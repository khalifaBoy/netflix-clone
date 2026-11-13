import mongoose from "mongoose";
import { MAX_MOVIE_DURATION_SECONDS } from "../services/movie-duration.service.js";
import { isWatchHistoryComplete } from "../services/watch-history-policy.service.js";

const watchHistorySchema = new mongoose.Schema({
  profile: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Profile",
    required: true,
  },
  movie: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Movie",
    required: true,
  },
  progressSeconds: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
    validate: Number.isFinite,
  },
  durationSeconds: {
    type: Number,
    default: null,
    min: 1,
    max: MAX_MOVIE_DURATION_SECONDS,
    validate: (value) => value == null || Number.isInteger(value),
  },
  lastWatchedAt: {
    type: Date,
    required: true,
    default: Date.now,
  },
  completedAt: {
    type: Date,
    default: null,
  },
  watchCount: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
    validate: Number.isInteger,
  },
});

watchHistorySchema.pre("validate", function validateProgress(next) {
  if (this.durationSeconds != null && this.progressSeconds > this.durationSeconds) {
    this.invalidate("progressSeconds", "Progress cannot exceed duration");
  }
  next();
});

watchHistorySchema.index({ profile: 1, movie: 1 }, { unique: true });
watchHistorySchema.index({ profile: 1, lastWatchedAt: -1 });

/**
 * Persist server-validated progress. durationSeconds must come from the Movie
 * catalog document, never from the playback client's media element.
 */
watchHistorySchema.statics.upsertProgress = async function upsertProgress({
  profile,
  movie,
  progressSeconds,
  durationSeconds = null,
}) {
  const existing = await this.findOne({ profile, movie })
    .select("durationSeconds completedAt")
    .lean();
  const previousDurationSeconds = normalizeStoredDuration(existing?.durationSeconds);
  const lastWatchedAt = new Date();
  const trustedDurationSeconds = durationSeconds == null
    ? previousDurationSeconds
    : durationSeconds;
  const record = new this({
    profile,
    movie,
    progressSeconds,
    durationSeconds: trustedDurationSeconds,
    lastWatchedAt,
  });
  await record.validate();

  // Completion is server-derived and only written when the trusted catalog
  // duration is known. Ordinary updates never set completedAt to null.
  const set = { progressSeconds, lastWatchedAt };
  if (durationSeconds != null) set.durationSeconds = durationSeconds;
  else if (existing?.durationSeconds != null && previousDurationSeconds === null) set.durationSeconds = null;
  if (!existing?.completedAt && isWatchHistoryComplete(progressSeconds, trustedDurationSeconds)) {
    set.completedAt = new Date();
  }

  // Progress requests can arrive out of order; playback-session sequencing is
  // deferred. Serialize client writes to avoid stale positions replacing newer ones.
  const filter = { profile, movie };
  try {
    return await this.findOneAndUpdate(
      filter,
      { $set: set },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );
  } catch (error) {
    // A concurrent first write may win the unique profile/movie index after
    // this call's existence check. Retry as an ordinary update, without upsert.
    if (error?.code !== 11000) throw error;
    return this.findOneAndUpdate(
      filter,
      { $set: set },
      { new: true, runValidators: true },
    );
  }
};

const normalizeStoredDuration = (value) =>
  Number.isSafeInteger(value) && value > 0 && value <= MAX_MOVIE_DURATION_SECONDS ? value : null;

export default mongoose.model("WatchHistory", watchHistorySchema);
