import assert from "node:assert/strict";
import test from "node:test";
import { buildBrowseMovieSections } from "../lib/browse-movie-sections.mjs";
import { getMovieWatchPath } from "../lib/movie-navigation.mjs";
import { normalizeRecommendationMovie } from "../lib/recommendation-feed.mjs";

const movieA = {
  _id: "64b000000000000000000001",
  title: "Space Drama",
  genres: ["Sci-Fi", "Drama"],
  maturityRating: "All",
  isTop10: true,
  views: 100,
  createdAt: "2025-01-01T00:00:00.000Z",
};
const movieB = {
  _id: "64b000000000000000000002",
  title: "Action Horror",
  genres: ["Action", "Horror"],
  maturityRating: "All",
  views: 250,
  createdAt: "2024-01-01T00:00:00.000Z",
};

test("For You, Movies, Trending, genre, Search, and My List use the shared Mongo movie watch route", () => {
  const entryPointMovieIds = {
    "For You": normalizeRecommendationMovie(movieA).id,
    Movies: normalizeRecommendationMovie(movieA).id,
    Trending: buildBrowseMovieSections([movieA, movieB]).rows.find((row) => row.title === "Trending Now").movies[0]._id,
    Genre: buildBrowseMovieSections([movieA, movieB]).rows.find((row) => row.title === "Sci-Fi & Future").movies[0]._id,
    Search: normalizeRecommendationMovie(movieA).id,
    "My List": movieB._id,
  };

  for (const [source, movieId] of Object.entries(entryPointMovieIds)) {
    assert.equal(getMovieWatchPath(movieId), `/watch/${movieId}`, source);
  }
});

test("Browse sections and Top 10 contain only the supplied backend Mongo movie records", () => {
  const sections = buildBrowseMovieSections([movieA, movieB]);
  assert.deepEqual(sections.topTen.map((movie) => movie._id), [movieA._id]);
  assert.deepEqual(sections.rows.find((row) => row.title === "Trending Now").movies.map((movie) => movie._id), [movieB._id, movieA._id]);
  assert.deepEqual(sections.rows.find((row) => row.title === "Horror Nights").movies.map((movie) => movie._id), [movieB._id]);
  assert.deepEqual(sections.rows.find((row) => row.title === "Action & Adventure").movies.map((movie) => movie._id), [movieB._id]);
  assert.deepEqual(sections.rows.find((row) => row.title === "Critically Acclaimed Dramas").movies.map((movie) => movie._id), [movieA._id]);
  assert.equal(sections.rows.some((row) => row.movies.some((movie) => movie.id === "t1" || movie.id === "s1")), false);
});

test("API normalization does not treat a legacy external id as a Mongo movie id", () => {
  assert.equal(normalizeRecommendationMovie({ id: "t1", title: "Placeholder" }).id, "");
  assert.equal(getMovieWatchPath("t1"), null);
  assert.equal(getMovieWatchPath(""), null);
  assert.equal(getMovieWatchPath(undefined), null);
  assert.equal(getMovieWatchPath("64b00000000000000000000z"), null);
});
