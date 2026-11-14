const PLAYBACK_SESSION_PATH = /(\/api\/playback\/sessions)\/[^/?#\s"'<>]+/gi;

export const redactPlaybackSessionUrl = (value) =>
  String(value).replace(PLAYBACK_SESSION_PATH, "$1/:sessionId");

export const safeRequestPath = (requestUrl = "/") => {
  const pathname = String(requestUrl).split(/[?#]/, 1)[0] || "/";
  return redactPlaybackSessionUrl(pathname);
};
