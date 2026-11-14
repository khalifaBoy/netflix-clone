export const getResumeProgressSeconds = (history, movieId) => {
  if (!Array.isArray(history) || typeof movieId !== "string") return 0;
  const record = history.find((entry) => {
    const id = typeof entry?.movie === "string" ? entry.movie : entry?.movie?._id;
    return id === movieId;
  });
  const progressSeconds = record?.progressSeconds;
  const durationSeconds = record?.durationSeconds;
  if (record?.completedAt || typeof progressSeconds !== "number" || !Number.isFinite(progressSeconds) || progressSeconds <= 0) return 0;
  if (typeof durationSeconds === "number" && Number.isFinite(durationSeconds) && durationSeconds > 0 && progressSeconds >= durationSeconds) return 0;
  return progressSeconds;
};
