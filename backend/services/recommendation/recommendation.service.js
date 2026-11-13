import { getEligibleCandidates } from "./candidate.service.js";
import { extractProfilePreferences } from "./preference.service.js";
import { rerankCandidates } from "./groq-reranker.service.js";
import { rankMovies } from "./scoring.service.js";

export const generateDeterministicRecommendations = async ({
  profileId,
  userId,
  limit = 20,
  candidateLimit,
  weights,
  negativePenaltyMax,
  now,
  rerank = true,
}) => {
  const preferences = await extractProfilePreferences({ profileId, userId, now });
  const candidates = await getEligibleCandidates({
    profileId,
    maturityPolicy: preferences.maturityPolicy,
    limit: candidateLimit,
  });
  const ranked = rankMovies(candidates, preferences, { weights, negativePenaltyMax });
  const rerankPool = ranked.slice(0, 30);
  const finalRanking = rerank
    ? await rerankCandidates(rerankPool, preferences)
    : rerankPool;
  const parsedLimit = Number(limit);
  const safeLimit = Number.isSafeInteger(parsedLimit) && parsedLimit > 0
    ? Math.min(parsedLimit, 15)
    : 15;

  return {
    profileId: String(profileId),
    profile: {
      id: preferences.maturityPolicy.profileId,
      name: preferences.maturityPolicy.profileName,
    },
    movies: finalRanking.slice(0, safeLimit),
    totalCandidates: ranked.length,
  };
};
