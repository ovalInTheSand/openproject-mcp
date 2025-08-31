// src/util/logger.ts - Minimal structured logger with env-based levels
type Level = 'debug' | 'info' | 'warn' | 'error';
const ORDER: Level[] = ['debug','info','warn','error'];
function cur(): Level {
  const lvl = (globalThis as any).MCP_LOG_LEVEL; // Provided via global injection if desired
  return (lvl as Level) || 'info';
}
function ok(l: Level){ return ORDER.indexOf(l) >= ORDER.indexOf(cur()); }
function line(obj: Record<string, unknown>){ return JSON.stringify({ ts: new Date().toISOString(), ...obj }); }
export const log = {
  debug(msg: string, extra?: Record<string, unknown>){ if (ok('debug')) {console.log(line({ level:'debug', msg, ...extra }));} },
  info(msg: string, extra?: Record<string, unknown>){ if (ok('info')) {console.log(line({ level:'info', msg, ...extra }));} },
  warn(msg: string, extra?: Record<string, unknown>){ if (ok('warn')) {console.warn(line({ level:'warn', msg, ...extra }));} },
  error(msg: string, extra?: Record<string, unknown>){ if (ok('error')) {console.error(line({ level:'error', msg, ...extra }));} }
};