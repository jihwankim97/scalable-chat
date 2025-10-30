import { Injectable } from '@nestjs/common';

@Injectable()
export class CommonService {
  constructor() {}

  async retry<T>(
    task: () => Promise<T>,
    opts: { attempts: number; baseDelayMs?: number; maxDelayMs?: number } = {
      attempts: 5,
    },
  ): Promise<T> {
    const base = opts.baseDelayMs ?? 300;
    const max = opts.maxDelayMs ?? 3000;

    let lastErr: Error;
    for (let attempt = 1; attempt <= opts.attempts; attempt++) {
      try {
        return await task();
      } catch (e) {
        lastErr = e;
        if (attempt === opts.attempts) break;
        const jitter = Math.floor(Math.random() * 100);
        const delay = Math.min(base * 2 ** (attempt - 1) + jitter, max);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
    throw lastErr instanceof Error ? lastErr : new Error('리트라이 실패');
  }
}
