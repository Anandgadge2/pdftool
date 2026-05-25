/**
 * Engine 2: Image-Based Review Notes Extractor
 * Supports Gemini (default) and OpenAI vision providers.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import type { PdfNoteType, VisionExtractedNote, VisionExtractionResult } from '@/lib/pdf-review-types';

const VISION_PROMPT = `Analyze this PDF page screenshot and extract ONLY review comments, handwritten notes, highlights, arrows, boxes, circles, underlines, and marked areas.

Ignore normal dashboard/UI text unless it is directly connected to a handwritten note or marked region.

Return strict JSON only with this shape:
{
  "notes": [
    {
      "noteType": "handwritten_note | highlight | arrow | box | circle | underline | marked_area | sticky_note",
      "extractedText": "text visible in or near the markup",
      "summary": "short meaning of the note",
      "position": { "x": 0, "y": 0, "width": 0, "height": 0 },
      "confidence": 0.0
    }
  ]
}

Coordinates must be in pixels relative to the image top-left corner. Confidence is 0.0 to 1.0.`;

const VALID_NOTE_TYPES = new Set<PdfNoteType>([
  'handwritten_note',
  'highlight',
  'arrow',
  'box',
  'circle',
  'underline',
  'marked_area',
  'sticky_note',
  'digital_comment',
]);

export type VisionProvider = 'gemini' | 'openai';

function parseVisionJson(content: string): VisionExtractionResult {
  let cleaned = content.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();

  const parsed = JSON.parse(cleaned) as { notes?: unknown[] };
  const notes: VisionExtractedNote[] = [];

  if (!Array.isArray(parsed.notes)) {
    return { notes: [] };
  }

  for (const item of parsed.notes) {
    if (!item || typeof item !== 'object') continue;
    const raw = item as Record<string, unknown>;
    const noteType = String(raw.noteType ?? 'handwritten_note') as PdfNoteType;
    if (!VALID_NOTE_TYPES.has(noteType)) continue;

    const pos = (raw.position ?? {}) as Record<string, number>;
    notes.push({
      noteType,
      extractedText: String(raw.extractedText ?? '').trim(),
      summary: String(raw.summary ?? raw.extractedText ?? '').trim().slice(0, 200),
      position: {
        x: Number(pos.x) || 0,
        y: Number(pos.y) || 0,
        width: Number(pos.width) || 0,
        height: Number(pos.height) || 0,
      },
      confidence: Math.min(1, Math.max(0, Number(raw.confidence) || 0.5)),
    });
  }

  return { notes };
}

export function getVisionProvider(): VisionProvider {
  const explicit = process.env.VISION_PROVIDER?.toLowerCase();
  if (explicit === 'gemini' || explicit === 'openai') return explicit;
  if (process.env.GEMINI_API_KEY) return 'gemini';
  if (process.env.VISION_API_KEY || process.env.OPENAI_API_KEY) return 'openai';
  return 'gemini';
}

function getGeminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY;
}

function getOpenAiApiKey(): string | undefined {
  return process.env.VISION_API_KEY || process.env.OPENAI_API_KEY;
}

export function isVisionConfigured(): boolean {
  const provider = getVisionProvider();
  if (provider === 'gemini') return Boolean(getGeminiApiKey());
  return Boolean(getOpenAiApiKey());
}

async function extractWithGemini(
  imageBuffer: Buffer,
  pageNumber: number
): Promise<VisionExtractedNote[]> {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return [];

  const modelName =
    process.env.VISION_MODEL ||
    process.env.GEMINI_MODEL ||
    'gemini-2.0-flash';

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 4096,
      responseMimeType: 'application/json',
    },
  });

  const base64 = imageBuffer.toString('base64');
  const request = () =>
    model.generateContent([
      VISION_PROMPT,
      {
        inlineData: {
          mimeType: 'image/png',
          data: base64,
        },
      },
    ]);

  const fallbackModel = 'gemini-2.0-flash';
  let result;
  try {
    result = await request();
  } catch (firstErr) {
    if (modelName === fallbackModel) throw firstErr;
    console.warn(
      `[visionExtractor] Gemini model "${modelName}" failed, retrying with ${fallbackModel}`
    );
    const fallback = genAI.getGenerativeModel({
      model: fallbackModel,
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    });
    result = await fallback.generateContent([
      VISION_PROMPT,
      { inlineData: { mimeType: 'image/png', data: base64 } },
    ]);
  }

  const content = result.response.text();
  const parsed = parseVisionJson(content);
  console.log(
    `[visionExtractor] Page ${pageNumber}: ${parsed.notes.length} notes via Gemini`
  );
  return parsed.notes;
}

async function extractWithOpenAI(
  imageBuffer: Buffer,
  pageNumber: number
): Promise<VisionExtractedNote[]> {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) return [];

  const baseURL = process.env.VISION_API_BASE_URL;
  const client = new OpenAI({
    apiKey,
    ...(baseURL ? { baseURL } : {}),
  });

  const model = process.env.VISION_MODEL ?? 'gpt-4o-mini';
  const base64 = imageBuffer.toString('base64');
  const dataUrl = `data:image/png;base64,${base64}`;

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: VISION_PROMPT },
          {
            type: 'image_url',
            image_url: { url: dataUrl, detail: 'high' },
          },
        ],
      },
    ],
    max_tokens: 4096,
    temperature: 0.1,
  });

  const content = response.choices[0]?.message?.content ?? '{"notes":[]}';
  const parsed = parseVisionJson(content);
  console.log(
    `[visionExtractor] Page ${pageNumber}: ${parsed.notes.length} notes via OpenAI (${model})`
  );
  return parsed.notes;
}

export async function extractNotesFromPageImage(
  imageBuffer: Buffer,
  pageNumber: number,
  imageWidth: number,
  imageHeight: number
): Promise<VisionExtractedNote[]> {
  void imageWidth;
  void imageHeight;

  if (!isVisionConfigured()) {
    console.warn(
      `[visionExtractor] No vision API key for provider "${getVisionProvider()}" — page ${pageNumber}`
    );
    return [];
  }

  try {
    const provider = getVisionProvider();
    if (provider === 'gemini') {
      return await extractWithGemini(imageBuffer, pageNumber);
    }
    return await extractWithOpenAI(imageBuffer, pageNumber);
  } catch (err) {
    console.error(`[visionExtractor] Page ${pageNumber} vision API error:`, err);
    return [];
  }
}

export async function extractNotesFromAllPages(
  pages: Array<{
    pageNumber: number;
    buffer: Buffer;
    width: number;
    height: number;
  }>
): Promise<Map<number, VisionExtractedNote[]>> {
  const results = new Map<number, VisionExtractedNote[]>();

  for (const page of pages) {
    const notes = await extractNotesFromPageImage(
      page.buffer,
      page.pageNumber,
      page.width,
      page.height
    );
    results.set(page.pageNumber, notes);
  }

  return results;
}
