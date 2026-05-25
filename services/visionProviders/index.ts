import { createGeminiVisionProvider } from './geminiVisionProvider';
import { createOpenAiVisionProvider } from './openaiVisionProvider';
import type { VisionProvider, VisionProviderName } from './types';

export * from './types';

export function getVisionProviderName(): VisionProviderName {
  const explicit = process.env.VISION_PROVIDER?.toLowerCase();
  if (explicit === 'gemini' || explicit === 'openai') return explicit;
  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.VISION_API_KEY || process.env.OPENAI_API_KEY) return 'openai';
  return 'gemini';
}

export function getVisionProvider(): VisionProvider {
  const name = getVisionProviderName();
  return name === 'openai' ? createOpenAiVisionProvider() : createGeminiVisionProvider();
}

export function isVisionConfigured(): boolean {
  return getVisionProvider().isConfigured();
}
