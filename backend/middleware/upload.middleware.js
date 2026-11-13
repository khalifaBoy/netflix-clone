import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import ApiError from "../utils/ApiError.js";

const middlewareDirectory = path.dirname(fileURLToPath(import.meta.url));
const uploadDirectory = path.resolve(middlewareDirectory, "../uploads/videos");
if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirectory);
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname);
    const filename = `${file.fieldname}-${Date.now()}${extension}`;
    cb(null, filename);
  },
});
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    "video/mp4",
    "video/mkv",
    "video/avi",
    "video/mov",
    "video/mpeg",
  ];
  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Only supported video files are allowed"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // Limit file size to 100MB
    files: 1,
    fields: 24,
    parts: 25,
    fieldNameSize: 100,
    fieldSize: 16 * 1024,
  },
});
export default upload;
