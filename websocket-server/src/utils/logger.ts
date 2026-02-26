type Level = 'info' | 'warn' | 'error';

function log(level: Level, message: string, data?: unknown) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(data !== undefined ? { data } : {}),
  };
  if (level === 'error') {
    console.error(JSON.stringify(entry));
  } else {
    console.log(JSON.stringify(entry));
  }
}

export const logger = {
  info: (msg: string, data?: unknown) => log('info', msg, data),
  warn: (msg: string, data?: unknown) => log('warn', msg, data),
  error: (msg: string, data?: unknown) => log('error', msg, data),
};
