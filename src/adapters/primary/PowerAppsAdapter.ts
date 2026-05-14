import { CaptureSignatureResponse } from '../../application/dto/CaptureSignatureResponse.js';
import { CaptureSignatureRequest } from '../../application/dto/CaptureSignatureRequest.js';
import { SignatureCaptureOrchestrator } from '../../application/services/SignatureCaptureOrchestrator.js';
import { Result } from '../../domain/shared/Result.js';
import { LoggerPort } from '../../ports/LoggerPort.js';

/**
 * Wire-shape of a message exchanged between a Power Apps Canvas app and
 * the connector hosted in an iframe / PCF control.
 */
export interface PowerAppsMessage {
  readonly type: 'captureSignature' | 'cancel' | 'ping';
  readonly correlationId: string;
  readonly payload?: CaptureSignatureRequest;
}

export interface PowerAppsResponse {
  readonly correlationId: string;
  readonly ok: boolean;
  readonly data?: CaptureSignatureResponse;
  readonly error?: { code: string; message: string };
}

/**
 * Primary adapter that translates postMessage / Power Apps Custom
 * Connector calls into use-case invocations. Used in two scenarios:
 *
 *   1. Component is hosted inside an iframe embedded in a Power Apps
 *      Canvas screen (the most portable pattern). The Canvas app posts a
 *      `PowerAppsMessage` and awaits the corresponding `PowerAppsResponse`.
 *
 *   2. Component is hosted inside a PCF control. The PCF wrapper calls
 *      `handleRequest` directly without going through postMessage.
 */
export class PowerAppsAdapter {
  constructor(
    private readonly orchestrator: SignatureCaptureOrchestrator,
    private readonly logger: LoggerPort,
  ) {}

  /** Wire `window.postMessage` for iframe integration. */
  attachPostMessageBridge(allowedOrigin: string | RegExp = '*'): () => void {
    const listener = async (event: MessageEvent) => {
      if (!this.originAllowed(event.origin, allowedOrigin)) return;
      const msg = this.safeParse(event.data);
      if (!msg) return;
      const response = await this.handleRequest(msg);
      (event.source as Window | null)?.postMessage(response, event.origin);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }

  async handleRequest(msg: PowerAppsMessage): Promise<PowerAppsResponse> {
    switch (msg.type) {
      case 'ping':
        return { correlationId: msg.correlationId, ok: true };
      case 'captureSignature':
        if (!msg.payload) {
          return this.fail(msg.correlationId, 'BAD_REQUEST', 'Missing payload');
        }
        return this.capture(msg.correlationId, msg.payload);
      case 'cancel':
        // Cancelation is best-effort; the in-flight capture will be
        // settled with SignatureCancelledError by the orchestrator.
        return { correlationId: msg.correlationId, ok: true };
      default:
        return this.fail(msg.correlationId, 'UNKNOWN_TYPE', `Unknown message ${msg.type}`);
    }
  }

  private async capture(
    correlationId: string,
    payload: CaptureSignatureRequest,
  ): Promise<PowerAppsResponse> {
    try {
      const result = await this.orchestrator.run(payload);
      if (Result.isFail(result)) {
        this.logger.warn('Power Apps capture failed', {
          code: result.error.code,
          message: result.error.message,
        });
        return this.fail(correlationId, result.error.code, result.error.message);
      }
      return {
        correlationId,
        ok: true,
        data: CaptureSignatureResponse.fromResult(result.value),
      };
    } catch (err) {
      this.logger.error('Power Apps capture raised', err);
      return this.fail(
        correlationId,
        'UNEXPECTED',
        err instanceof Error ? err.message : String(err),
      );
    }
  }

  private fail(correlationId: string, code: string, message: string): PowerAppsResponse {
    return { correlationId, ok: false, error: { code, message } };
  }

  private safeParse(raw: unknown): PowerAppsMessage | null {
    if (raw && typeof raw === 'object' && 'type' in raw && 'correlationId' in raw) {
      return raw as PowerAppsMessage;
    }
    if (typeof raw === 'string') {
      try {
        return JSON.parse(raw) as PowerAppsMessage;
      } catch {
        return null;
      }
    }
    return null;
  }

  private originAllowed(origin: string, allowed: string | RegExp): boolean {
    if (allowed === '*') return true;
    if (allowed instanceof RegExp) return allowed.test(origin);
    return origin === allowed;
  }
}
