import { PenPoint } from '../../domain/entities/PenPoint.js';
import { Signature } from '../../domain/entities/Signature.js';
import { SignatureCaptureResult } from '../../domain/entities/SignatureCaptureResult.js';
import { SignatureMetadata } from '../../domain/entities/SignatureMetadata.js';
import { TabletInfo } from '../../domain/entities/TabletInfo.js';
import { DomainError } from '../../domain/errors/DomainError.js';
import {
  SignatureCancelledError,
  SignatureCaptureError,
  SignatureEmptyError,
} from '../../domain/errors/SignatureCaptureError.js';
import { TabletTimeoutError } from '../../domain/errors/TabletConnectionError.js';
import { Result } from '../../domain/shared/Result.js';
import { CanvasRendererPort } from '../../ports/CanvasRendererPort.js';
import { ConfigPort } from '../../ports/ConfigPort.js';
import { LoggerPort } from '../../ports/LoggerPort.js';
import { SignatureSdkPort } from '../../ports/SignatureSdkPort.js';
import {
  TabletButton,
  TabletEvent,
  WacomTabletPort,
} from '../../ports/WacomTabletPort.js';
import { CaptureSignatureRequest } from '../dto/CaptureSignatureRequest.js';

/**
 * Orchestrates a single capture session:
 *  - subscribes to pen/button events,
 *  - buffers PenPoints in memory,
 *  - renders strokes to the host canvas for visual feedback,
 *  - resolves on OK, rejects on Cancel or timeout,
 *  - assembles a Signature + SigObj + image once the user confirms.
 */
export class CaptureSignatureUseCase {
  constructor(
    private readonly tablet: WacomTabletPort,
    private readonly sdk: SignatureSdkPort,
    private readonly renderer: CanvasRendererPort,
    private readonly config: ConfigPort,
    private readonly logger: LoggerPort,
  ) {}

  async execute(
    request: CaptureSignatureRequest,
    tabletInfo: TabletInfo,
  ): Promise<Result<SignatureCaptureResult, DomainError>> {
    if (!this.tablet.isConnected()) {
      return Result.fail(
        new SignatureCaptureError('Cannot capture: tablet is not connected'),
      );
    }

    const cfg = this.config.get();
    const points: PenPoint[] = [];
    let lastPoint: PenPoint | undefined;

    const captureResult = await new Promise<
      Result<SignatureCaptureResult, DomainError>
    >((resolve) => {
      const finish = (r: Result<SignatureCaptureResult, DomainError>) => {
        unsubscribe();
        clearTimeout(timer);
        resolve(r);
      };

      const handle = (event: TabletEvent) => {
        if (event.type === 'pen' && event.penPoint) {
          points.push(event.penPoint);
          const renderRes = this.renderer.drawPenPoint(event.penPoint, lastPoint);
          if (Result.isFail(renderRes)) {
            this.logger.debug('Canvas draw failed', { msg: renderRes.error.message });
          }
          lastPoint = event.penPoint;
          return;
        }
        if (event.type === 'button' && event.button) {
          this.handleButton(event.button, points, tabletInfo, request)
            .then(finish)
            .catch((err) =>
              finish(
                Result.fail(
                  new SignatureCaptureError(
                    'Unhandled exception in button handler',
                    err,
                  ),
                ),
              ),
            );
        }
        if (event.type === 'disconnected') {
          finish(
            Result.fail(
              new SignatureCaptureError(
                'Tablet disconnected during capture',
                event.error,
              ),
            ),
          );
        }
      };

      const unsubscribe = this.tablet.onEvent(handle);

      const timeoutMs = request.timeoutMs ?? cfg.captureTimeoutMs;
      const timer = setTimeout(() => {
        finish(
          Result.fail(
            new TabletTimeoutError(
              `Signature capture timed out after ${timeoutMs}ms`,
            ),
          ),
        );
      }, timeoutMs);
    });

    return captureResult;
  }

  private async handleButton(
    button: TabletButton,
    points: PenPoint[],
    tabletInfo: TabletInfo,
    request: CaptureSignatureRequest,
  ): Promise<Result<SignatureCaptureResult, DomainError>> {
    switch (button) {
      case 'clear':
        points.length = 0;
        this.renderer.clear();
        await this.tablet.clear();
        // 'clear' returns control to capture — re-arm by returning a
        // non-terminal sentinel. We model this by re-resolving on the
        // next button press; the simplest implementation is to leave the
        // promise unsettled. To do so we return a never-resolving value.
        return new Promise(() => undefined);

      case 'cancel':
        // Wipe the tablet LCD so the next session starts clean. We ignore
        // the result because the user is cancelling anyway.
        await this.tablet.clear();
        this.renderer.clear();
        return Result.fail(
          new SignatureCancelledError('User cancelled the signature'),
        );

      case 'ok':
        return this.finalise(points, tabletInfo, request);
    }
  }

  private async finalise(
    points: readonly PenPoint[],
    tabletInfo: TabletInfo,
    request: CaptureSignatureRequest,
  ): Promise<Result<SignatureCaptureResult, DomainError>> {
    if (points.length === 0 || points.every((p) => p.isPenUp())) {
      return Result.fail(new SignatureEmptyError('Signature is empty'));
    }

    const metadata = SignatureMetadata.fromInput({
      who: request.signerName,
      why: request.reason,
      application: request.application,
      documentHash: request.documentHash,
    });

    let signature: Signature;
    try {
      signature = Signature.create({
        points,
        metadata,
        width: tabletInfo.capabilities.tabletWidth,
        height: tabletInfo.capabilities.tabletHeight,
      });
    } catch (err) {
      return Result.fail(
        new SignatureCaptureError('Failed to assemble Signature aggregate', err),
      );
    }

    const sigObj = await this.sdk.buildSigObj({
      points,
      metadata,
      width: tabletInfo.capabilities.tabletWidth,
      height: tabletInfo.capabilities.tabletHeight,
    });
    if (Result.isFail(sigObj)) return sigObj;

    const cfg = this.config.get();
    const image = await this.sdk.renderImage({
      signature,
      format: request.outputFormat ?? 'png',
      widthPx: request.outputWidthPx ?? tabletInfo.capabilities.screenWidthPx,
      heightPx: request.outputHeightPx ?? tabletInfo.capabilities.screenHeightPx,
      inkColor: cfg.ui.inkColor,
      inkWidthPx: cfg.ui.inkWidthPx,
      transparent: request.transparentBackground,
    });
    if (Result.isFail(image)) return image;

    return Result.ok(
      SignatureCaptureResult.create({
        signature: sigObj.value.signature,
        sigObjBase64: sigObj.value.sigObjBase64,
        image: image.value,
      }),
    );
  }
}
