import { describe, expect, it, vi } from 'vitest';

import { PowerAppsAdapter } from '../../src/adapters/primary/PowerAppsAdapter';
import { ConsoleLoggerAdapter } from '../../src/adapters/secondary/ConsoleLoggerAdapter';
import { Result } from '../../src/domain/shared/Result';

describe('PowerAppsAdapter', () => {
  it('replies to ping with ok=true', async () => {
    const orchestrator = { run: vi.fn() };
    const adapter = new PowerAppsAdapter(orchestrator as never, new ConsoleLoggerAdapter('error'));
    const r = await adapter.handleRequest({ type: 'ping', correlationId: 'abc' });
    expect(r).toEqual({ correlationId: 'abc', ok: true });
  });

  it('returns a structured error when capture fails', async () => {
    const orchestrator = {
      run: vi.fn(async () =>
        Result.fail({ code: 'TABLET_NOT_FOUND', message: 'No tablet', name: 'X' } as never),
      ),
    };
    const adapter = new PowerAppsAdapter(orchestrator as never, new ConsoleLoggerAdapter('error'));
    const r = await adapter.handleRequest({
      type: 'captureSignature',
      correlationId: 'c1',
      payload: { signerName: 'a', reason: 'b' },
    });
    expect(r.ok).toBe(false);
    expect(r.error?.code).toBe('TABLET_NOT_FOUND');
  });
});
