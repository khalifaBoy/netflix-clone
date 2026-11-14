import { requireProfileMaturityPolicy } from "../services/maturity-policy.service.js";

const profileIdFromRequest = (req) => req.query.profileId || req.body?.profileId;

/** Resolve and attach an authenticated user's owned profile policy to the request. */
const requireProfilePolicy = async (req, res, next) => {
  try {
    req.profileMaturityPolicy = await requireProfileMaturityPolicy(
      profileIdFromRequest(req),
      req.user?._id,
    );
    return next();
  } catch (error) {
    return next(error);
  }
};

export default requireProfilePolicy;
