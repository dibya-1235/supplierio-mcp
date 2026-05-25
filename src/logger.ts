import { appendFile, readFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

export interface LogEntry {
  timestamp: string;
  username: string;
  tool: string;
  params: Record<string, unknown>;
  resultCount: number;
  latencyMs: number;
}

function getLogPath(): string {
  return process.env.LOG_PATH ?? '/tmp/usage.log';
}

export async function log(entry: LogEntry): Promise<void> {
  try {
    const logPath = getLogPath();
    await mkdir(dirname(logPath), { recursive: true });
    await appendFile(logPath, JSON.stringify(entry) + '\n', 'utf8');
  } catch {
    // swallow — logging must never break a tool call
  }
}

export async function readLastN(n: number): Promise<LogEntry[]> {
  if (n <= 0) return [];
  try {
    const content = await readFile(getLogPath(), 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    return lines
      .slice(-n)
      .flatMap((line) => {
        try {
          return [JSON.parse(line) as LogEntry];
        } catch {
          return [];
        }
      });
  } catch {
    return [];
  }
}
