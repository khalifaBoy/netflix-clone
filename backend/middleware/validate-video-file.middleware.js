import { open, unlink } from "node:fs/promises";
import path from "node:path";
import ApiError from "../utils/ApiError.js";

const VIDEO_SIGNATURES = Object.freeze({
  ".mp4": { types: ["video/mp4"], matches: (bytes) => bytes.subarray(4, 8).toString("ascii") === "ftyp" },
  ".mov": { types: ["video/mov", "video/quicktime"], matches: (bytes) => bytes.subarray(4, 8).toString("ascii") === "ftyp" },
  ".mkv": { types: ["video/mkv", "video/x-matroska"], matches: (bytes) => bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3])) },
  ".avi": { types: ["video/avi", "video/x-msvideo"], matches: (bytes) => bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "AVI " },
  ".mpeg": { types: ["video/mpeg"], matches: (bytes) => hasMpegStartCode(bytes) },
  ".mpg": { types: ["video/mpeg"], matches: (bytes) => hasMpegStartCode(bytes) },
});

function hasMpegStartCode(bytes) {
  for (let index = 0; index + 3 < bytes.length; index += 1) {
    if (bytes[index] === 0 && bytes[index + 1] === 0 && bytes[index + 2] === 1
      && [0xb3, 0xba, 0xb8].includes(bytes[index + 3])) return true;
  }
  return false;
}

const unsupportedVideo = () => new ApiError(
  415,
  "UNSUPPORTED_MEDIA_TYPE",
  "Uploaded file is not a supported video format",
);

/** Verify the stored upload's extension, declared MIME type, and container signature. */
export const validateVideoFile = async (req, res, next) => {
  if (!req.file) return next();

  const extension = path.extname(req.file.filename).toLowerCase();
  const format = VIDEO_SIGNATURES[extension];
  if (!format || !format.types.includes(req.file.mimetype)) {
    await unlink(req.file.path).catch(() => {});
    return next(unsupportedVideo());
  }

  let handle;
  try {
    handle = await open(req.file.path, "r");
    const bytes = Buffer.alloc(64 * 1024);
    const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
    if (!format.matches(bytes.subarray(0, bytesRead))) {
      await handle.close();
      handle = null;
      await unlink(req.file.path).catch(() => {});
      return next(unsupportedVideo());
    }
    await handle.close();
    handle = null;
    return next();
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    await unlink(req.file.path).catch(() => {});
    return next(error instanceof ApiError ? error : unsupportedVideo());
  }
};

export default validateVideoFile;
