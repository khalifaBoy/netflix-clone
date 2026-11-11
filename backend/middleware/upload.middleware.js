import multer from "multer";
import fs from "fs";
import path from "path";

const uploadDirectory = "uploads/videos"; // Specify the directory where uploaded files will be stored
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
    cb(new Error("Invalid file type. Only video files are allowed."), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // Limit file size to 100MB
  },
});
export default upload;
