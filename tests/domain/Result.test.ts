import { describe, expect, it } from 'vitest';

import { Result } from '../../src/domain/shared/Result';

describe('Result', () => {
  it('detects success and failure variants', () => {
    const ok = Result.ok(42);
    const fail = Result.fail(new Error('nope'));
    expect(Result.isOk(ok)).toBe(true);
    expect(Result.isFail(fail)).toBe(true);
  });

  it('maps the success value without touching failures', () => {
    const ok = Result.map(Result.ok(2), (v) => v + 1);
    const fail = Result.map(Result.fail<Error>(new Error('x')), (v: number) => v + 1);
    expect(Result.isOk(ok) && ok.value).toBe(3);
    expect(Result.isFail(fail)).toBe(true);
  });

  it('wraps promises and converts rejections into failures', async () => {
    const ok = await Result.fromPromise(Promise.resolve('hi'));
    const fail = await Result.fromPromise(Promise.reject('boom'));
    expect(Result.isOk(ok) && ok.value).toBe('hi');
    expect(Result.isFail(fail) && fail.error.message).toBe('boom');
  });
});
