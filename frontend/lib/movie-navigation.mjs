const MONGO_OBJECT_ID = /^[a-f\d]{24}$/i;

export const getMovieWatchPath = (movieId) =>
  typeof movieId === "string" && MONGO_OBJECT_ID.test(movieId)
    ? `/watch/${movieId}`
    : null;

