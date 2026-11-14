import "dotenv/config";
import assert from "node:assert/strict";
import { createHash, randomInt } from "node:crypto";
import { readFile, symlink, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, afterEach, before, test } from "node:test";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import app from "../src/app.js";
import User from "../models/User.js";
import Profile from "../models/Profile.js";
import Movie from "../models/Movie.js";
import PlaybackSession from "../models/PlaybackSession.js";
import { validatePlaybackSession } from "../services/playback-session.service.js";
import { connectRecommendationTestDatabase, disconnectRecommendationTestDatabase } from "./helpers/recommendation-test-db.js";

const TEST_JWT_SECRET = "playback-session-integration-test-secret-not-for-production";
process.env.JWT_SECRET = TEST_JWT_SECRET;
const uploadDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../uploads/videos");
const publicUploadDirectory = path.dirname(uploadDirectory);
const fixtures = [];
let server;
let baseUrl;
let fileSequence = 0;

before(async () => {
  await connectRecommendationTestDatabase();
  server = app.listen(0);
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterEach(async () => {
  for (const item of fixtures.splice(0)) {
    await Promise.all([
      PlaybackSession.deleteMany({ $or: [{ user: { $in: item.userIds } }, { profile: { $in: item.profileIds } }] }),
      Profile.deleteMany({ _id: { $in: item.profileIds } }),
      Movie.deleteMany({ _id: { $in: item.movieIds } }),
      User.deleteMany({ _id: { $in: item.userIds } }),
      ...item.files.map((file) => unlink(file).catch(() => {})),
    ]);
  }
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await disconnectRecommendationTestDatabase();
});

const fixture = () => {
  const item = { userIds: [], profileIds: [], movieIds: [], files: [] };
  fixtures.push(item);
  return item;
};

const createIdentity = async (item, { maturityLevel = "All", isKids = false, name = "Playback Test" } = {}) => {
  const user = await User.create({
    name,
    email: `${name.toLowerCase().replaceAll(" ", "-")}-${new mongoose.Types.ObjectId()}@example.test`,
    password: "test-password-only",
    role: "user",
    isActive: true,
  });
  item.userIds.push(user._id);
  const profile = await Profile.create({ user: user._id, name: `${name} profile`, maturityLevel, isKids, isActive: true });
  item.profileIds.push(profile._id);
  const token = jwt.sign({ userId: String(user._id) }, TEST_JWT_SECRET, { expiresIn: "5m" });
  return { user, profile, token };
};

const createMovie = async (item, options = {}) => {
  const fileName = `video-${Date.now()}${String(++fileSequence).padStart(4, "0")}.mp4`;
  const filePath = path.join(uploadDirectory, fileName);
  await writeFile(filePath, Buffer.from(`playback fixture ${randomInt(0, 0x7fffffff)}`));
  item.files.push(filePath);
  const movie = await Movie.create({
    title: `Playback Movie ${new mongoose.Types.ObjectId()}`,
    description: "Playback session test movie",
    backdrop: "/test-backdrop.jpg",
    poster: "/test-poster.jpg",
    year: 2025,
    rating: "PG",
    duration: "90 min",
    durationSeconds: 5400,
    genres: ["Drama"],
    videoUrl: `/uploads/videos/${fileName}`,
    maturityRating: "All",
    isPublished: true,
    ...options,
  });
  item.movieIds.push(movie._id);
  return movie;
};

const request = (pathName, token, options = {}) => fetch(`${baseUrl}/api/playback${pathName}`, {
  ...options,
  headers: {
    ...(options.body ? { "content-type": "application/json" } : {}),
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  },
});

const createSessionRequest = (identity, profileId, movieId) => request("/sessions", identity?.token, {
  method: "POST",
  body: JSON.stringify({ profileId: String(profileId), movieId: String(movieId) }),
});

const mediaRequest = (mediaUrl, options = {}) => fetch(`${baseUrl}${mediaUrl}`, options);

const createSession = async (identity, movie, profile = identity.profile) => {
  const response = await createSessionRequest(identity, profile._id, movie._id);
  assert.equal(response.status, 201);
  return (await response.json()).session;
};

test("creates a random credential bound to the authenticated user, profile, and movie", async () => {
  const item = fixture();
  const identity = await createIdentity(item);
  const movie = await createMovie(item);
  const response = await createSessionRequest(identity, identity.profile._id, movie._id);
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(body.success, true);
  assert.match(body.session.sessionId, /^[A-Za-z0-9_-]{40,60}$/);
  assert.equal(body.session.movieId, String(movie._id));
  assert.equal(body.session.mediaUrl, `/api/playback/sessions/${body.session.sessionId}/media`);
  const expiresIn = new Date(body.session.expiresAt).getTime() - Date.now();
  assert.ok(expiresIn > 0 && expiresIn <= 15 * 60 * 1000);

  const stored = await PlaybackSession.findOne({ movie: movie._id }).lean();
  assert.ok(stored);
  assert.notEqual(stored.credentialHash, body.session.sessionId);
  assert.equal(stored.user.toString(), identity.user._id.toString());
  assert.equal(stored.profile.toString(), identity.profile._id.toString());
});

test("requires authentication and an owned active profile", async () => {
  const item = fixture();
  const identity = await createIdentity(item);
  const other = await createIdentity(item, { name: "Playback Other User" });
  const movie = await createMovie(item);

  assert.equal((await createSessionRequest(null, identity.profile._id, movie._id)).status, 401);
  assert.equal((await createSessionRequest(other, identity.profile._id, movie._id)).status, 404);
  assert.equal((await createSessionRequest(identity, new mongoose.Types.ObjectId(), movie._id)).status, 404);
  assert.equal((await request("/sessions", identity.token, {
    method: "POST",
    body: JSON.stringify({ movieId: String(movie._id) }),
  })).status, 400);
});

test("rejects missing, unpublished, restricted, and unknown-rated movies", async () => {
  const item = fixture();
  const identity = await createIdentity(item, { maturityLevel: "7+" });
  const missingFile = await createMovie(item, { title: "Missing file" });
  const hidden = await createMovie(item, { isPublished: false });
  const restricted = await createMovie(item, { maturityRating: "13+" });
  const unknown = await createMovie(item, { maturityRating: "TV-MA" });

  await unlink(item.files[0]);
  assert.equal((await createSessionRequest(identity, identity.profile._id, new mongoose.Types.ObjectId())).status, 404);
  assert.equal((await createSessionRequest(identity, identity.profile._id, hidden._id)).status, 404);
  assert.equal((await createSessionRequest(identity, identity.profile._id, restricted._id)).status, 404);
  assert.equal((await createSessionRequest(identity, identity.profile._id, unknown._id)).status, 404);
  assert.equal((await createSessionRequest(identity, identity.profile._id, missingFile._id)).status, 404);
});

test("Kids profiles remain capped at 7+ and invalid stored references are rejected", async () => {
  const item = fixture();
  const kids = await createIdentity(item, { maturityLevel: "18+", isKids: true, name: "Playback Kids" });
  const restricted = await createMovie(item, { maturityRating: "13+" });
  const traversal = await createMovie(item, { videoUrl: "/uploads/videos/../../etc/passwd" });
  const external = await createMovie(item, { videoUrl: "https://example.test/video.mp4" });

  assert.equal((await createSessionRequest(kids, kids.profile._id, restricted._id)).status, 404);
  assert.equal((await createSessionRequest(kids, kids.profile._id, traversal._id)).status, 404);
  assert.equal((await createSessionRequest(kids, kids.profile._id, external._id)).status, 404);
});

test("rejects video symlinks to files outside or to another movie inside the storage directory", async () => {
  const item = fixture();
  const identity = await createIdentity(item, { maturityLevel: "7+" });
  const restrictedMovie = await createMovie(item, { maturityRating: "18+" });
  const outsidePath = path.join(publicUploadDirectory, `outside-${new mongoose.Types.ObjectId()}.mp4`);
  const outsideLinkPath = path.join(uploadDirectory, `video-${Date.now()}${String(++fileSequence).padStart(4, "0")}.mp4`);
  const internalLinkPath = path.join(uploadDirectory, `video-${Date.now()}${String(++fileSequence).padStart(4, "0")}.mp4`);
  await writeFile(outsidePath, Buffer.from("outside target"));
  await symlink(outsidePath, outsideLinkPath);
  await symlink(path.join(uploadDirectory, path.basename(restrictedMovie.videoUrl)), internalLinkPath);
  item.files.push(outsidePath, outsideLinkPath, internalLinkPath);

  const linkedMovie = await createMovie(item, {
    title: "Safe Rating That Must Not Alias Restricted Media",
    maturityRating: "7+",
    videoUrl: `/uploads/videos/${path.basename(internalLinkPath)}`,
  });
  const outsideLinkedMovie = await createMovie(item, {
    title: "Outside Symlink Movie",
    videoUrl: `/uploads/videos/${path.basename(outsideLinkPath)}`,
  });

  assert.equal((await createSessionRequest(identity, identity.profile._id, linkedMovie._id)).status, 404);
  assert.equal((await createSessionRequest(identity, identity.profile._id, outsideLinkedMovie._id)).status, 404);
});

test("validation rejects expired and revoked sessions and a mismatched movie", async () => {
  const item = fixture();
  const identity = await createIdentity(item);
  const other = await createIdentity(item, { name: "Playback Other" });
  const movie = await createMovie(item);
  const anotherMovie = await createMovie(item);
  const session = await createSession(identity, movie);
  const binding = { sessionId: session.sessionId, userId: identity.user._id, profileId: identity.profile._id };

  await assert.rejects(validatePlaybackSession({ ...binding, movieId: anotherMovie._id }), { statusCode: 404 });
  await assert.rejects(validatePlaybackSession({ ...binding, movieId: movie._id, profileId: new mongoose.Types.ObjectId() }), { statusCode: 404 });
  await assert.rejects(validatePlaybackSession({
    sessionId: session.sessionId,
    userId: other.user._id,
    profileId: other.profile._id,
    movieId: movie._id,
  }), { statusCode: 404 });

  await PlaybackSession.updateOne({ movie: movie._id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  await assert.rejects(validatePlaybackSession({ ...binding, movieId: movie._id }), { statusCode: 404 });

  const activeSession = await createSession(identity, movie);
  const revoked = await request(`/sessions/${activeSession.sessionId}`, identity.token, { method: "DELETE" });
  assert.equal(revoked.status, 200);
  await assert.rejects(validatePlaybackSession({
    sessionId: activeSession.sessionId,
    userId: identity.user._id,
    profileId: identity.profile._id,
    movieId: movie._id,
  }), { statusCode: 404 });
});

test("rechecks maturity at use time and prevents reuse by another profile", async () => {
  const item = fixture();
  const identity = await createIdentity(item, { maturityLevel: "18+" });
  const secondProfile = await Profile.create({ user: identity.user._id, name: "Second profile", maturityLevel: "18+", isActive: true });
  item.profileIds.push(secondProfile._id);
  const movie = await createMovie(item, { maturityRating: "13+" });
  const session = await createSession(identity, movie);

  await assert.rejects(validatePlaybackSession({
    sessionId: session.sessionId,
    userId: identity.user._id,
    profileId: secondProfile._id,
    movieId: movie._id,
  }), { statusCode: 404 });

  await Profile.updateOne({ _id: identity.profile._id }, { $set: { maturityLevel: "7+" } });
  await assert.rejects(validatePlaybackSession({
    sessionId: session.sessionId,
    userId: identity.user._id,
    profileId: identity.profile._id,
    movieId: movie._id,
  }), { statusCode: 404 });
});

test("streams video through a session, blocks public video URLs, and preserves public artwork", async () => {
  const item = fixture();
  const identity = await createIdentity(item);
  const movie = await createMovie(item);
  const expectedBytes = await readFile(item.files[0]);
  const session = await createSession(identity, movie);
  const response = await mediaRequest(session.mediaUrl);
  const body = Buffer.from(await response.arrayBuffer());

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "video/mp4");
  assert.equal(response.headers.get("content-length"), String(expectedBytes.length));
  assert.equal(response.headers.get("accept-ranges"), "bytes");
  assert.match(response.headers.get("cache-control"), /private/);
  assert.match(response.headers.get("cache-control"), /no-store/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.deepEqual(body, expectedBytes);

  const videoPath = `/uploads/videos/${path.basename(item.files[0])}`;
  const publicResponse = await fetch(`${baseUrl}${videoPath}`);
  assert.equal(publicResponse.status, 404);
  assert.equal((await publicResponse.text()).includes(uploadDirectory), false);

  const encodedVideoResponse = await fetch(`${baseUrl}/uploads/%76ideos/${path.basename(item.files[0])}`);
  assert.equal(encodedVideoResponse.status, 404);
  const doubleEncodedVideoResponse = await fetch(`${baseUrl}/uploads/%2576ideos/${path.basename(item.files[0])}`);
  assert.equal(doubleEncodedVideoResponse.status, 404);
  const doubleEncodedTraversalResponse = await fetch(`${baseUrl}/uploads/%252e%252e/%2576ideos/${path.basename(item.files[0])}`);
  assert.equal(doubleEncodedTraversalResponse.status, 404);
  let deeplyEncodedVideoDirectory = "%76ideos";
  for (let layer = 0; layer < 9; layer += 1) {
    deeplyEncodedVideoDirectory = deeplyEncodedVideoDirectory.replaceAll("%", "%25");
  }
  const deeplyEncodedVideoResponse = await fetch(
    `${baseUrl}/uploads/${deeplyEncodedVideoDirectory}/${path.basename(item.files[0])}`,
  );
  assert.equal(deeplyEncodedVideoResponse.status, 404);
  const normalizedTraversalResponse = await fetch(`${baseUrl}/uploads/public/%2e%2e/videos/${path.basename(item.files[0])}`);
  assert.equal(normalizedTraversalResponse.status, 404);

  const posterPath = path.join(publicUploadDirectory, `poster-${new mongoose.Types.ObjectId()}.jpg`);
  const thumbnailPath = path.join(publicUploadDirectory, `thumbnail-${new mongoose.Types.ObjectId()}.jpg`);
  const imageBytes = Buffer.from("public image fixture");
  await Promise.all([writeFile(posterPath, imageBytes), writeFile(thumbnailPath, imageBytes)]);
  item.files.push(posterPath, thumbnailPath);

  for (const assetPath of [posterPath, thumbnailPath]) {
    const assetResponse = await fetch(`${baseUrl}/uploads/${path.basename(assetPath)}`);
    assert.equal(assetResponse.status, 200);
    assert.deepEqual(Buffer.from(await assetResponse.arrayBuffer()), imageBytes);
  }
});

test("admin movie upload still stores videos without making the file public", async () => {
  const item = fixture();
  const identity = await createIdentity(item);
  identity.user.role = "admin";
  await identity.user.save();

  const form = new FormData();
  form.append("title", "Uploaded Playback Fixture");
  form.append("description", "Movie upload integration fixture");
  form.append("backdrop", "/fixture-backdrop.jpg");
  form.append("poster", "/fixture-poster.jpg");
  form.append("year", "2025");
  form.append("rating", "PG");
  form.append("duration", "90 min");
  form.append("maturityRating", "All");
  form.append("video", new Blob([Buffer.from([
    0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70,
    0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x02, 0x00,
    0x69, 0x73, 0x6f, 0x6d, 0x6d, 0x70, 0x34, 0x32,
  ])], { type: "video/mp4" }), "fixture.mp4");

  const spoofedForm = new FormData();
  spoofedForm.append("video", new Blob(["not a video"], { type: "video/mp4" }), "spoof.mp4");
  const spoofedUpload = await fetch(`${baseUrl}/api/movies`, {
    method: "POST",
    headers: { authorization: `Bearer ${identity.token}` },
    body: spoofedForm,
  });
  assert.equal(spoofedUpload.status, 415);

  const response = await fetch(`${baseUrl}/api/movies`, {
    method: "POST",
    headers: { authorization: `Bearer ${identity.token}` },
    body: form,
  });
  assert.equal(response.status, 201);
  const result = await response.json();
  assert.equal(result.success, true);
  item.movieIds.push(new mongoose.Types.ObjectId(result.movie._id));
  const storedVideoPath = path.join(uploadDirectory, path.basename(result.movie.videoUrl));
  item.files.push(storedVideoPath);

  const directAccess = await fetch(`${baseUrl}${result.movie.videoUrl}`);
  assert.equal(directAccess.status, 404);
});

test("supports closed, open-ended, and suffix byte ranges", async () => {
  const item = fixture();
  const identity = await createIdentity(item);
  const movie = await createMovie(item);
  const expectedBytes = await readFile(item.files[0]);
  const session = await createSession(identity, movie);

  const cases = [
    { range: "bytes=1-4", start: 1, end: 4 },
    { range: `bytes=${expectedBytes.length - 3}-`, start: expectedBytes.length - 3, end: expectedBytes.length - 1 },
    { range: "bytes=-5", start: expectedBytes.length - 5, end: expectedBytes.length - 1 },
  ];
  for (const itemCase of cases) {
    const response = await mediaRequest(session.mediaUrl, { headers: { Range: itemCase.range } });
    const body = Buffer.from(await response.arrayBuffer());
    assert.equal(response.status, 206, itemCase.range);
    assert.equal(response.headers.get("content-range"), `bytes ${itemCase.start}-${itemCase.end}/${expectedBytes.length}`);
    assert.equal(response.headers.get("content-length"), String(itemCase.end - itemCase.start + 1));
    assert.deepEqual(body, expectedBytes.subarray(itemCase.start, itemCase.end + 1));
  }
});

test("rejects unsatisfiable, malformed, and multiple ranges with 416", async () => {
  const item = fixture();
  const identity = await createIdentity(item);
  const movie = await createMovie(item);
  const session = await createSession(identity, movie);
  const size = (await readFile(item.files[0])).length;

  for (const range of [
    `bytes=${size}-`,
    "bytes=4-2",
    "bytes=-0",
    "bytes=wat",
    "bytes=0-1,3-4",
    "bytes=0-3,2-5",
    "bytes=9007199254740992-",
  ]) {
    const response = await mediaRequest(session.mediaUrl, { headers: { Range: range } });
    assert.equal(response.status, 416, range);
    assert.equal(response.headers.get("content-range"), `bytes */${size}`);
    assert.equal(response.headers.get("content-length"), "0");
    assert.equal((await response.arrayBuffer()).byteLength, 0);
  }
});

test("HEAD returns representation headers without bytes, including for a satisfiable range", async () => {
  const item = fixture();
  const identity = await createIdentity(item);
  const movie = await createMovie(item);
  const session = await createSession(identity, movie);
  const size = (await readFile(item.files[0])).length;

  const head = await mediaRequest(session.mediaUrl, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get("content-length"), String(size));
  assert.equal((await head.arrayBuffer()).byteLength, 0);

  const rangedHead = await mediaRequest(session.mediaUrl, { method: "HEAD", headers: { Range: "bytes=0-2" } });
  assert.equal(rangedHead.status, 206);
  assert.equal(rangedHead.headers.get("content-range"), `bytes 0-2/${size}`);
  assert.equal(rangedHead.headers.get("content-length"), "3");
  assert.equal((await rangedHead.arrayBuffer()).byteLength, 0);
});

test("rejects missing and invalid credentials without disclosing storage paths", async () => {
  const item = fixture();
  const identity = await createIdentity(item);
  const movie = await createMovie(item);
  const session = await createSession(identity, movie);
  const missing = await mediaRequest("/api/playback/sessions//media");
  const invalid = await mediaRequest("/api/playback/sessions/not-a-valid-credential/media");
  const arbitrary = await fetch(`${baseUrl}/api/playback/media?path=${encodeURIComponent(item.files[0])}`);
  const expectedPublicPath = item.files[0];

  for (const response of [missing, invalid, arbitrary]) {
    assert.equal(response.status, 404);
    const body = await response.text();
    assert.equal(body.includes(expectedPublicPath), false);
    assert.equal(body.includes("/uploads/videos/"), false);
  }
  assert.ok(session.sessionId);
});

test("rechecks publication, maturity, ownership, expiry, and revocation on every stream", async () => {
  const item = fixture();
  const identity = await createIdentity(item, { maturityLevel: "18+" });
  const movie = await createMovie(item, { maturityRating: "13+" });

  const maturitySession = await createSession(identity, movie);
  await Profile.updateOne({ _id: identity.profile._id }, { $set: { maturityLevel: "7+" } });
  assert.equal((await mediaRequest(maturitySession.mediaUrl)).status, 404);
  await Profile.updateOne({ _id: identity.profile._id }, { $set: { maturityLevel: "18+" } });

  const unpublishedSession = await createSession(identity, movie);
  await Movie.updateOne({ _id: movie._id }, { $set: { isPublished: false } });
  assert.equal((await mediaRequest(unpublishedSession.mediaUrl)).status, 404);
  await Movie.updateOne({ _id: movie._id }, { $set: { isPublished: true } });

  const revokedSession = await createSession(identity, movie);
  assert.equal((await request(`/sessions/${revokedSession.sessionId}`, identity.token, { method: "DELETE" })).status, 200);
  assert.equal((await mediaRequest(revokedSession.mediaUrl)).status, 404);

  const expiredSession = await createSession(identity, movie);
  await PlaybackSession.updateOne(
    { credentialHash: createHash("sha256").update(expiredSession.sessionId).digest("hex") },
    { $set: { expiresAt: new Date(Date.now() - 1000) } },
  );
  assert.equal((await mediaRequest(expiredSession.mediaUrl)).status, 404);

  const ownerSession = await createSession(identity, movie);
  const other = await createIdentity(item, { name: "Reassigned" });
  await Profile.updateOne({ _id: identity.profile._id }, { $set: { user: other.user._id } });
  assert.equal((await mediaRequest(ownerSession.mediaUrl)).status, 404);

  const deactivated = await createIdentity(item, { name: "Deactivated" });
  const deactivatedSession = await createSession(deactivated, movie);
  await User.updateOne({ _id: deactivated.user._id }, { $set: { isActive: false } });
  assert.equal((await mediaRequest(deactivatedSession.mediaUrl)).status, 404);
});

test("returns a generic unavailable response if the validated file disappears before streaming", async () => {
  const item = fixture();
  const identity = await createIdentity(item);
  const movie = await createMovie(item);
  const session = await createSession(identity, movie);
  const expectedPath = item.files[0];
  await unlink(expectedPath);

  const response = await mediaRequest(session.mediaUrl);
  assert.equal(response.status, 404);
  const body = await response.text();
  assert.equal(body.includes(expectedPath), false);
  assert.equal(body.includes("/uploads/videos/"), false);
});

test("closes an interrupted response and can serve a later request", async () => {
  const item = fixture();
  const identity = await createIdentity(item);
  const movie = await createMovie(item);
  await writeFile(item.files[0], Buffer.alloc(4 * 1024 * 1024, 65));
  const session = await createSession(identity, movie);
  const abortController = new AbortController();
  const response = await mediaRequest(session.mediaUrl, { signal: abortController.signal });
  assert.equal(response.status, 200);
  const reader = response.body.getReader();
  const firstChunk = await reader.read();
  assert.ok(firstChunk.value?.byteLength > 0);
  abortController.abort();
  await reader.cancel().catch(() => {});

  const followUp = await mediaRequest(session.mediaUrl, { headers: { Range: "bytes=0-3" } });
  assert.equal(followUp.status, 206);
  assert.deepEqual(Buffer.from(await followUp.arrayBuffer()), Buffer.from([65, 65, 65, 65]));
});
