/**
 * TasteProvider — LLM-backed food ranking and conversational assistant.
 *
 * Live path: Anthropic Messages API or OpenAI Chat Completions.
 * Mock path: pure heuristic via rankFoodHeuristic from @/core.
 *
 * Prompts are kept minimal to stay token-thrifty.
 */

import type { Place, TasteProvider, TripPreferences } from '@/core';
import { rankFoodHeuristic } from '@/core';
import { serviceConfig, features } from './config';

const TIMEOUT_MS = 20_000; // LLM calls can take longer

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function withTimeout(ms: number): AbortController {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller;
}

/** Compact place summary sent to the LLM (token-thrifty). */
interface PlaceSummary {
  id: string;
  name: string;
  category: string;
  rating?: number;
  tags?: string[];
  price?: number | null;
}

function toSummary(p: Place): PlaceSummary {
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    rating: p.rating,
    tags: p.tags?.slice(0, 4),
    price: p.price?.amount,
  };
}

/** Compact prefs summary for the prompt. */
interface PrefsSummary {
  budget?: string;
  cuisine?: string[];
  dietary?: string[];
  interests?: string[];
}

function prefsSummary(prefs: TripPreferences): PrefsSummary {
  return {
    budget: prefs.foodBudget,
    cuisine: prefs.cuisinePrefs,
    dietary: prefs.dietary,
    interests: prefs.interests,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Anthropic Messages API
// ─────────────────────────────────────────────────────────────────────────────

interface AnthropicMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnthropicResponse {
  content: Array<{ type: string; text: string }>;
}

async function callAnthropic(prompt: string): Promise<string> {
  const controller = withTimeout(TIMEOUT_MS);
  const body: {
    model: string;
    max_tokens: number;
    messages: AnthropicMessage[];
  } = {
    model: serviceConfig.llmModel,
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  };

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal: controller.signal,
    headers: {
      'content-type': 'application/json',
      'x-api-key': serviceConfig.llmApiKey ?? '',
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}`);
  const data = (await res.json()) as AnthropicResponse;
  const block = data.content.find((c) => c.type === 'text');
  if (!block) throw new Error('No text block in Anthropic response');
  return block.text;
}

// ─────────────────────────────────────────────────────────────────────────────
// OpenAI Chat Completions API
// ─────────────────────────────────────────────────────────────────────────────

interface OpenAIResponse {
  choices: Array<{ message: { content: string } }>;
}

async function callOpenAI(prompt: string): Promise<string> {
  const controller = withTimeout(TIMEOUT_MS);
  const body = {
    model: serviceConfig.llmModel,
    max_tokens: 512,
    messages: [{ role: 'user', content: prompt }],
  };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    signal: controller.signal,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${serviceConfig.llmApiKey ?? ''}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);
  const data = (await res.json()) as OpenAIResponse;
  const text = data.choices[0]?.message?.content;
  if (!text) throw new Error('No content in OpenAI response');
  return text;
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM dispatch
// ─────────────────────────────────────────────────────────────────────────────

async function callLLM(prompt: string): Promise<string> {
  if (serviceConfig.llmProvider === 'anthropic') {
    return callAnthropic(prompt);
  }
  return callOpenAI(prompt);
}

// ─────────────────────────────────────────────────────────────────────────────
// Robust ID list parser
// Handles: ["id1","id2"], ["id1", "id2"], id1,id2, bullet lists, etc.
// ─────────────────────────────────────────────────────────────────────────────

function parseIdList(text: string): string[] {
  // Strip markdown fences
  const clean = text.replace(/```[\s\S]*?```/g, '').replace(/`/g, '');

  // Try JSON array first
  const jsonMatch = /\[([^\]]*)\]/.exec(clean);
  if (jsonMatch) {
    try {
      const parsed: unknown = JSON.parse(`[${jsonMatch[1]}]`);
      if (Array.isArray(parsed)) {
        return (parsed as unknown[]).map((x) => String(x).trim()).filter(Boolean);
      }
    } catch {
      // continue to fallback
    }
  }

  // Fallback: extract quoted strings or bare words on separate lines
  const ids: string[] = [];
  for (const line of clean.split(/[\n,]+/)) {
    const stripped = line.replace(/^[\s\-*•"']+|["'\s]+$/g, '');
    if (stripped) ids.push(stripped);
  }
  return ids;
}

// ─────────────────────────────────────────────────────────────────────────────
// Heuristic canned response (mock mode)
// ─────────────────────────────────────────────────────────────────────────────

const HEURISTIC_RESPONSES = [
  "Based on your preferences, I'd recommend focusing on local specialties and well-rated spots near your itinerary. Ask the hotel concierge for hidden gems!",
  "Great question! For the best food experience, look for places with consistent high ratings and cuisine that matches your dietary preferences.",
  "Try to eat where the locals eat — markets and smaller family-run spots often outperform tourist-oriented restaurants at lower prices.",
];

function heuristicAnswer(prompt: string): string {
  // Very naive intent routing based on keyword presence
  const lower = prompt.toLowerCase();
  if (/budget|cheap|price|cost/.test(lower)) {
    return "For budget-friendly eating, prioritise street food, markets, and lunch menus at otherwise pricier restaurants.";
  }
  if (/vegan|vegetarian|dietary|allerg/.test(lower)) {
    return "Many restaurants now clearly label vegan and vegetarian options. Look for dedicated veg-friendly or plant-based places in your area.";
  }
  return HEURISTIC_RESPONSES[Math.abs(prompt.length) % HEURISTIC_RESPONSES.length];
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export const tasteProvider: TasteProvider = {
  name: features.liveTaste
    ? (serviceConfig.llmProvider ?? 'anthropic')
    : 'heuristic',

  // ── rankFood ──────────────────────────────────────────────────────────────
  async rankFood(
    candidates: Place[],
    prefs: TripPreferences,
    context?: string,
  ): Promise<Place[]> {
    // Always pre-rank with the heuristic to reduce the candidate set
    const preRanked = rankFoodHeuristic(candidates, prefs).slice(0, 12);

    if (!features.liveTaste || preRanked.length === 0) {
      return preRanked;
    }

    try {
      const summaries = preRanked.map(toSummary);
      const pSummary = prefsSummary(prefs);

      const prompt =
        `You are a travel food recommender. Re-rank these restaurants best-first for this traveller.\n` +
        `Traveller prefs: ${JSON.stringify(pSummary)}\n` +
        (context ? `Context: ${context}\n` : '') +
        `Restaurants (JSON): ${JSON.stringify(summaries)}\n\n` +
        `Reply with ONLY a JSON array of ids in your preferred order, e.g. ["id1","id2"]. ` +
        `Include all ids. No explanation.`;

      const text = await callLLM(prompt);
      const ids = parseIdList(text);

      if (ids.length === 0) return preRanked;

      // Reorder preRanked according to LLM response; append any not mentioned
      const byId = new Map(preRanked.map((p) => [p.id, p]));
      const reordered: Place[] = [];
      const seen = new Set<string>();

      for (const id of ids) {
        const p = byId.get(id);
        if (p && !seen.has(id)) {
          reordered.push(p);
          seen.add(id);
        }
      }
      // Append anything the LLM omitted
      for (const p of preRanked) {
        if (!seen.has(p.id)) reordered.push(p);
      }

      return reordered;
    } catch {
      // Any LLM or parse failure → fall back to heuristic
      return preRanked;
    }
  },

  // ── ask ───────────────────────────────────────────────────────────────────
  async ask(prompt: string): Promise<string> {
    if (!features.liveTaste) {
      return heuristicAnswer(prompt);
    }
    try {
      return await callLLM(prompt);
    } catch {
      return heuristicAnswer(prompt);
    }
  },
};
