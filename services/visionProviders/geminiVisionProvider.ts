import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  VISION_CROP_REFINEMENT_SUFFIX,
  VISION_EXTRACTION_PROMPT,
  VISION_STRICT_JSON_RETRY,
} from '@/services/visionPrompts';
import { parseVisionNotesJson } from '@/lib/pdf-review-pipeline';
import type { VisionAnalyzeOptions, VisionProvider, VisionProviderResult } from './types';
import { VisionApiError, classifyVisionError } from './types';

const FALLBACK_MODEL = 'gemini-2.0-flash';

export function createGeminiVisionProvider(): VisionProvider {
  return {
    name: 'gemini',
    isConfigured() {
      return Boolean(process.env.GEMINI_API_KEY);
    },
    async analyzeImage(buffer, options = {}) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new VisionApiError('GEMINI_API_KEY is not set.', 'auth', 'gemini');

      const modelName =
        process.env.VISION_MODEL || process.env.GEMINI_MODEL || 'gemini-1.5-flash';

      let prompt = VISION_EXTRACTION_PROMPT;
      if (options.isCrop) prompt += VISION_CROP_REFINEMENT_SUFFIX;
      if (options.retryStrictJson) prompt = VISION_STRICT_JSON_RETRY + '\n' + prompt;

      const base64 = buffer.toString('base64');
      const genAI = new GoogleGenerativeAI(apiKey);

      const run = async (model: string) => {
        const m = genAI.getGenerativeModel({
          model,
          generationConfig: {
            temperature: 0.08,
            maxOutputTokens: 4096,
            responseMimeType: 'application/json',
          },
        });
        const result = await m.generateContent([
          prompt,
          { inlineData: { mimeType: 'image/png', data: base64 } },
        ]);
        return result.response.text();
      };

      let content: string;
      let usedModel = modelName;
      try {
        content = await run(modelName);
      } catch (firstErr) {
        const classified = classifyVisionError(firstErr, 'gemini');
        if (
          modelName === FALLBACK_MODEL ||
          classified.code === 'quota' ||
          classified.code === 'auth'
        ) {
          throw classified;
        }
        console.warn(
          `[geminiVision] ${modelName} failed (${classified.code}), fallback ${FALLBACK_MODEL}`
        );
        usedModel = FALLBACK_MODEL;
        try {
          content = await run(FALLBACK_MODEL);
        } catch (fallbackErr) {
          throw classifyVisionError(fallbackErr, 'gemini');
        }
      }

      try {
        const notes = parseVisionNotesJson(content);
        return { notes, rawContent: content, provider: 'gemini', model: usedModel };
      } catch {
        if (!options.retryStrictJson) {
          return createGeminiVisionProvider().analyzeImage(buffer, {
            ...options,
            retryStrictJson: true,
          });
        }
        throw new VisionApiError('Gemini returned invalid JSON after retry.', 'invalid_json', 'gemini');
      }
    },
  };
}
