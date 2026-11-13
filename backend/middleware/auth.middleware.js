import jwt from "jsonwebtoken";
import User from "../models/User.js";
import ApiError from "../utils/ApiError.js";

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new ApiError(401, "UNAUTHORIZED", "Not authorized, no token");
    }
    const token = authHeader.split(" ")[1];
    if (!token) {
      throw new ApiError(401, "UNAUTHORIZED", "Not authorized, token missing");
    }
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        throw new ApiError(401, "TOKEN_EXPIRED", "Session expired, please log in again");
      }
      throw new ApiError(401, "INVALID_TOKEN", "Not authorized, invalid token");
    }
    const user = await User.findById(decoded.userId).select("-password");
    if (!user) {
      throw new ApiError(401, "UNAUTHORIZED", "Not authorized, user not found");
    }

    if (!user.isActive) {
      throw new ApiError(401, "UNAUTHORIZED", "Not authorized, user is inactive");
    }

    req.user = user;

    return next();
  } catch (error) {
    return next(error);
  }
};

export default protect;
