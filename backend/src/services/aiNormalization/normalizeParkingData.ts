import Anthropic from '@anthropic-ai/sdk';
import { env, aiNormalizationEnabled } from '../../config/env';
import { cache } from '../cache/inMemoryCacheProvider';
import { SYSTEM_PROMPT, buildUserPrompt, RawRestrictionRow, GENERIC_SYSTEM_PROMPT, buildGenericUserPrompt } from './prompts';
import {
  NormalizedRow,
  validateNormalizedBatch,
  GenericNormalizedRow,
  validateGenericNormalizedBatch,
} from './parkingSpotValidator';

const MODEL = 'claude-haiku-4-5-20251001';
const NORMALIZED_CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;
const DISABLED_SKIP_CACHE_TTL_SECONDS = 60 * 60;
const REPAIR_SUFFIX =
  '\n\nYour previous response failed JSON schema validation. Return ONLY a valid JSON array matching the required shape, no markdown formatting, no commentary.';

let client: Anthropic | null = null;

function getClient(): Anthropic | null {
  if (!aiNormalizationEnabled) return null;
  if (!client) client = new Anthropic({ apiKey: env.anthropicApiKey });
  return client;
}

// A council's raw data is chunked into many batches, and every batch would
// otherwise log its own "disabled" warning — harmless but drowns out real
// errors in production logs. One warning per council per process lifetime is
// enough to communicate the same thing.
const disabledWarningLoggedFor = new Set<string>();

function warnAiDisabledOnce(councilName: string): void {
  if (disabledWarningLoggedFor.has(councilName)) return;
  disabledWarningLoggedFor.add(councilName);
  console.warn(`AI normalization disabled (no ANTHROPIC_API_KEY set) — ${councilName} will fall back to OSM baseline only.`);
}

function extractJsonArray(text: string): string {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1) return text;
  return text.slice(start, end + 1);
}

async function callClaudeWithValidation<T>(
  systemPrompt: string,
  userPrompt: string,
  validate: (raw: unknown) => { success: true; data: T[] } | { success: false; error: string },
  councilName: string,
): Promise<T[] | null> {
  const anthropic = getClient();
  if (!anthropic) return null;

  for (let attempt = 0; attempt < 2; attempt++) {
    const message = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 4096,
      temperature: 0,
      system: systemPrompt,
      messages: [{ role: 'user', content: attempt === 0 ? userPrompt : userPrompt + REPAIR_SUFFIX }],
    });

    const textBlock = message.content.find((block) => block.type === 'text');
    if (!textBlock || textBlock.type !== 'text') continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJsonArray(textBlock.text));
    } catch {
      continue;
    }

    const validation = validate(parsed);
    if (validation.success) return validation.data;
    console.error(`AI normalization validation failed for ${councilName} (attempt ${attempt + 1}):`, validation.error);
  }

  return null;
}

/**
 * Normalizes a batch of raw council restriction rows into structured free-condition
 * data, caching the result by content hash so identical source data is never
 * re-sent to the LLM. Returns [] (never throws) if AI normalization is disabled
 * or fails after retries — callers should treat that as "no enrichment available"
 * and fall back to other sources (e.g. OSM baseline) rather than failing the request.
 */
export async function normalizeRestrictionRows(
  rows: RawRestrictionRow[],
  councilName: string,
  contentHash: string,
): Promise<NormalizedRow[]> {
  const cacheKey = `ai-normalized:${contentHash}`;
  const cached = cache.get<NormalizedRow[]>(cacheKey);
  if (cached) return cached;

  if (!aiNormalizationEnabled) {
    warnAiDisabledOnce(councilName);
    cache.set(cacheKey, [], DISABLED_SKIP_CACHE_TTL_SECONDS);
    return [];
  }

  const basePrompt = buildUserPrompt(rows, councilName, new Date().toISOString().slice(0, 10));
  const result = await callClaudeWithValidation(SYSTEM_PROMPT, basePrompt, validateNormalizedBatch, councilName);
  if (!result) {
    console.error(`AI normalization failed for ${councilName} after retries; skipping this batch.`);
    return [];
  }

  cache.set(cacheKey, result, NORMALIZED_CACHE_TTL_SECONDS);
  return result;
}

/**
 * Normalizes a batch of raw rows from a dynamically-discovered dataset (unknown
 * column names) into structured location + free-condition data. Unlike
 * normalizeRestrictionRows, the AI here must also identify coordinates/name/
 * address from arbitrary columns — callers MUST cross-validate any returned
 * lat/lng against the actual raw row (see utils/coordinateValidation) before
 * trusting it, since this path has a materially higher hallucination surface.
 */
export async function normalizeGenericRows(
  rows: Record<string, unknown>[],
  datasetTitle: string,
  councilName: string,
  contentHash: string,
): Promise<GenericNormalizedRow[]> {
  const cacheKey = `ai-normalized-generic:${contentHash}`;
  const cached = cache.get<GenericNormalizedRow[]>(cacheKey);
  if (cached) return cached;

  if (!aiNormalizationEnabled) {
    warnAiDisabledOnce(councilName);
    cache.set(cacheKey, [], DISABLED_SKIP_CACHE_TTL_SECONDS);
    return [];
  }

  const basePrompt = buildGenericUserPrompt(rows, datasetTitle, councilName, new Date().toISOString().slice(0, 10));
  const result = await callClaudeWithValidation(GENERIC_SYSTEM_PROMPT, basePrompt, validateGenericNormalizedBatch, councilName);
  if (!result) {
    console.error(`Generic AI normalization failed for ${councilName} after retries; skipping this batch.`);
    return [];
  }

  cache.set(cacheKey, result, NORMALIZED_CACHE_TTL_SECONDS);
  return result;
}
