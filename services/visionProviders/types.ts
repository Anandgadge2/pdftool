import type { RawVisionNote } from '@/lib/pdf-review-types';

export type VisionProviderName = 'gemini' | 'openai';

export interface VisionAnalyzeOptions {
  pageNumber?: number;
  isCrop?: boolean;
  retryStrictJson?: boolean;
}

export interface VisionProviderResult {
  notes: RawVisionNote[];
  rawContent: string;
  provider: VisionProviderName;
  model: string;
}

export interface VisionProvider {
  name: VisionProviderName;
  isConfigured(): boolean;
  analyzeImage(buffer: Buffer, options?: VisionAnalyzeOptions): Promise<VisionProviderResult>;
}

export class VisionApiError extends Error {
  constructor(
    message: string,
    public readonly code: 'quota' | 'auth' | 'invalid_json' | 'network' | 'unknown',
    public readonly provider: VisionProviderName
  ) {
    super(message);
    this.name = 'VisionApiError';
  }
}

export function classifyVisionError(err: unknown, provider: VisionProviderName): VisionApiError {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (lower.includes('quota') || lower.includes('rate') || lower.includes('429')) {
    return new VisionApiError('AI quota exceeded. Try again later or check billing.', 'quota', provider);
  }
  if (lower.includes('api key') || lower.includes('401') || lower.includes('403')) {
    return new VisionApiError('Invalid or missing API key for vision provider.', 'auth', provider);
  }
  if (lower.includes('json')) {
    return new VisionApiError('AI returned invalid JSON.', 'invalid_json', provider);
  }
  return new VisionApiError(msg, 'unknown', provider);
}
