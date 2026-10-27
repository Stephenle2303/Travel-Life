import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { recordAppDiagnostic } from '@/diagnostics/app-diagnostics';

const MAX_LONG_EDGE = 1600;

export type ShareImageDerivative = Readonly<{ uri: string; width: number; height: number; mimeType: 'image/jpeg' }>;

/** Re-encodes into a new private JPEG; callers must never upload the input URI. */
export async function createShareImageDerivative(input: Readonly<{ sourceUri: string; width: number; height: number; correlationId: string }>): Promise<ShareImageDerivative> {
  recordAppDiagnostic({ operation: 'SHARE_DERIVATIVE', reasonCode: 'START', stage: 'SHARE_DERIVATIVE_ENCODE', retryable: false, durableOutcome: 'unchanged', correlationId: input.correlationId });
  try {
    if (!input.sourceUri || !Number.isFinite(input.width) || !Number.isFinite(input.height) || input.width <= 0 || input.height <= 0) throw new Error('invalid-source');
    const scale = Math.min(1, MAX_LONG_EDGE / Math.max(input.width, input.height));
    const context = ImageManipulator.manipulate(input.sourceUri);
    context.resize({ width: Math.max(1, Math.round(input.width * scale)), height: Math.max(1, Math.round(input.height * scale)) });
    const rendered = await context.renderAsync();
    const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.85, base64: false });
    if (!saved.uri || !Number.isInteger(saved.width) || !Number.isInteger(saved.height) || saved.width < 1 || saved.height < 1 || Math.max(saved.width, saved.height) > MAX_LONG_EDGE) throw new Error('invalid-derivative');
    recordAppDiagnostic({ operation: 'SHARE_DERIVATIVE', reasonCode: 'COMPLETE', stage: 'SHARE_DERIVATIVE_VERIFY', retryable: false, durableOutcome: 'complete', correlationId: input.correlationId });
    return { uri: saved.uri, width: saved.width, height: saved.height, mimeType: 'image/jpeg' };
  } catch {
    recordAppDiagnostic({ operation: 'SHARE_DERIVATIVE', reasonCode: 'SHARE_DERIVATIVE_INVALID', stage: 'SHARE_DERIVATIVE_ENCODE', retryable: true, durableOutcome: 'failed', correlationId: input.correlationId });
    throw new Error('Share derivative did not finish.');
  }
}
