function log(level, msg) {
  const line = `${new Date().toISOString()} [${level}] ${msg}`;
  if (level === 'ERROR') console.error(line);
  else if (level === 'WARN') console.warn(line);
  else console.log(line);
}

module.exports = {
  info: (m) => log('INFO', m),
  warn: (m) => log('WARN', m),
  error: (m) => log('ERROR', m)
};
