import type { z } from 'zod/v4';

export function parseJsonArray<T>(raw: string, schema: z.ZodType<T>, agentName: string): T {
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) {
    throw new Error(`${agentName} output does not contain a JSON array`);
  }
  return schema.parse(JSON.parse(match[0]));
}

export function parseJsonObject<T>(raw: string, schema: z.ZodType<T>, agentName: string): T {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error(`${agentName} output does not contain a JSON object`);
  }
  return schema.parse(JSON.parse(match[0]));
}
