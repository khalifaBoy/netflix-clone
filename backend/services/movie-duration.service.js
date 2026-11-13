export const MAX_MOVIE_DURATION_SECONDS = 24 * 60 * 60;

/** Parse only explicitly supported human-readable duration formats. */
export const parseLegacyDurationSeconds = (value) => {
  if (typeof value !== "string") return null;
  const text = value.trim();

  const hoursAndMinutes = /^(\d{1,2})h(?:\s+(\d{2})m)?$/i.exec(text);
  if (hoursAndMinutes) {
    const hours = Number(hoursAndMinutes[1]);
    const minutes = hoursAndMinutes[2] === undefined ? 0 : Number(hoursAndMinutes[2]);
    if (minutes > 59) return null;
    return normalizeDurationSeconds((hours * 60 + minutes) * 60);
  }

  const minutesOnly = /^(\d{1,4})\s+min$/i.exec(text);
  if (minutesOnly) return normalizeDurationSeconds(Number(minutesOnly[1]) * 60);

  return null;
};

export const normalizeDurationSeconds = (value) => {
  let seconds = value;
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    seconds = Number(value.trim());
  }
  if (!Number.isSafeInteger(seconds) || seconds < 1 || seconds > MAX_MOVIE_DURATION_SECONDS) {
    return null;
  }
  return seconds;
};

export const resolveMovieDurationSecondsOnCreate = (displayDuration, suppliedDurationSeconds) => {
  if (suppliedDurationSeconds === undefined) return parseLegacyDurationSeconds(displayDuration);
  if (suppliedDurationSeconds === null) return null;
  return normalizeDurationSeconds(suppliedDurationSeconds);
};

export const resolveMovieDurationSecondsOnUpdate = ({
  currentDisplayDuration,
  currentDurationSeconds,
  nextDisplayDuration,
  suppliedDurationSeconds,
}) => {
  if (suppliedDurationSeconds !== undefined) {
    return suppliedDurationSeconds === null ? null : normalizeDurationSeconds(suppliedDurationSeconds);
  }
  if (nextDisplayDuration !== undefined && nextDisplayDuration !== currentDisplayDuration) {
    return parseLegacyDurationSeconds(nextDisplayDuration);
  }
  return normalizeDurationSeconds(currentDurationSeconds);
};
