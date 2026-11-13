import express from "express";
import protect from "../middleware/auth.middleware.js";
import { register, login, getMe } from "../controllers/auth.controler.js";
import { validateLogin, validateRegistration } from "../middleware/validate.middleware.js";
const router = express.Router();

router.post("/register", validateRegistration, register);
router.post("/login", validateLogin, login);
router.get("/me", protect, getMe);

export default router;
