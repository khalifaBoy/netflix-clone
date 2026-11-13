import { normalizeDurationSeconds } from "./movie-duration.service.js";

export const DEFAULT_WATCH_HISTORY_COMPLETION_THRESHOLD = 0.9;

export const getWatchHistoryCompletionThreshold = () => {
  const configured = Number(process.env.WATCH_HISTORY_COMPLETION_THRESHOLD);
  return Number.isFinite(configured) && configured > 0 && configured <= 1
    ? configured
    : DEFAULT_WATCH_HISTORY_COMPLETION_THRESHOLD;
};

export const isWatchHistoryComplete = (progressSeconds, durationSeconds) => {
  const duration = normalizeDurationSeconds(durationSeconds);
  return Number.isFinite(progressSeconds)
    && progressSeconds >= 0
    && duration !== null
    && progressSeconds <= duration
    && progressSeconds / duration >= getWatchHistoryCompletionThreshold();
};
