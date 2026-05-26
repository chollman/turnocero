const fmt = (level, msg, meta) =>
  JSON.stringify({ level, msg, ...meta, ts: new Date().toISOString() });

const logger = {
  info: (msg, meta = {}) => console.log(fmt("info", msg, meta)),
  warn: (msg, meta = {}) => console.warn(fmt("warn", msg, meta)),
  error: (msg, meta = {}) => console.error(fmt("error", msg, meta)),
};

module.exports = logger;
