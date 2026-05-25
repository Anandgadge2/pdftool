import OpenAI from 'openai';
import {
  VISION_CROP_REFINEMENT_SUFFIX,
  VISION_EXTRACTION_PROMPT,
  VISION_STRICT_JSON_RETRY,
} from '@/services/visionPrompts';
import { parseVisionNotesJson } from '@/lib/pdf-review-pipeline';
import type { VisionAnalyzeOptions, VisionProvider, VisionProviderResult } from './types';
import { VisionApiError, classifyVisionError } from './types';

export function createOpenAiVisionProvider(): VisionProvider {
  return {
    name: 'openai',
    isConfigured() {
      return Boolean(process.env.VISION_API_KEY || process.env.OPENAI_API_KEY);
    },
    async analyzeImage(buffer, options = {}) {
      const apiKey = process.env.VISION_API_KEY || process.env.OPENAI_API_KEY;
      if (!apiKey) throw new VisionApiError('OPENAI/VISION API key is not set.', 'auth', 'openai');

      const model = process.env.VISION_MODEL ?? 'gpt-4o-mini';
      let prompt = VISION_EXTRACTION_PROMPT;
      if (options.isCrop) prompt += VISION_CROP_REFINEMENT_SUFFIX;
      if (options.retryStrictJson) prompt = VISION_STRICT_JSON_RETRY + '\n' + prompt;

      const client = new OpenAI({
        apiKey,
        ...(process.env.VISION_API_BASE_URL
          ? { baseURL: process.env.VISION_API_BASE_URL }
          : {}),
      });

      const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`;

      try {
        const response = await client.chat.completions.create({
          model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } },
              ],
            },
          ],
          max_tokens: 4096,
          temperature: 0.08,
          response_format: { type: 'json_object' },
        });

        const content = response.choices[0]?.message?.content ?? '{"notes":[]}';
        try {
          const notes = parseVisionNotesJson(content);
          return { notes, rawContent: content, provider: 'openai', model };
        } catch {
          if (!options.retryStrictJson) {
            return createOpenAiVisionProvider().analyzeImage(buffer, {
              ...options,
              retryStrictJson: true,
            });
          }
          throw new VisionApiError('OpenAI returned invalid JSON after retry.', 'invalid_json', 'openai');
        }
      } catch (err) {
        throw classifyVisionError(err, 'openai');
      }
    },
  };
}
