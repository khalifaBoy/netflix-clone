import { safeRequestPath } from "../utils/security-log.js";

const chunkByteLength = (chunk, encoding) => {
  if (chunk === null || chunk === undefined || typeof chunk === "function") return 0;
  if (Buffer.isBuffer(chunk)) return chunk.length;
  if (ArrayBuffer.isView(chunk)) return chunk.byteLength;
  if (typeof chunk === "string") return Buffer.byteLength(chunk, typeof encoding === "string" ? encoding : "utf8");
  return 0;
};

export const requestLogger = (req, res, next) => {
  const startedAt = process.hrtime.bigint();
  let responseBytes = 0;
  const write = res.write;
  const end = res.end;

  res.write = function writeWithByteCount(...args) {
    responseBytes += chunkByteLength(args[0], args[1]);
    return write.apply(this, args);
  };
  res.end = function endWithByteCount(...args) {
    responseBytes += chunkByteLength(args[0], args[1]);
    return end.apply(this, args);
  };

  res.once("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const record = {
      method: req.method,
      path: safeRequestPath(req.originalUrl || req.url),
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(3)),
      responseBytes,
    };
    try {
      console.info(JSON.stringify(record));
    } catch {
      // Logging must never affect request completion.
    }
  });

  next();
};

export default requestLogger;
