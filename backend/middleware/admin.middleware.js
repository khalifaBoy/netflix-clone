import ApiError from "../utils/ApiError.js";

const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return next(new ApiError(401, "UNAUTHORIZED", "Authentication required"));
  }

  if (req.user.role !== "admin") {
    return next(new ApiError(403, "FORBIDDEN", "Admin access required"));
  }

  return next();
};

export default requireAdmin;
