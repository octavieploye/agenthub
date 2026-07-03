import type { PatternExtractionInput } from '../../types/common.types.js';
import type { PatternReport } from '../../types/patterns.types.js';
import type { LLMProvider } from '../../types/agent.types.js';
import * as patternExtractor from './agents/pattern-extractor.js';
import * as successAnalyst from './agents/success-analyst.js';
import * as failureAnalyst from './agents/failure-analyst.js';
import * as synthesisWriter from './agents/synthesis-writer.js';

export async function runGoodAndBad(
  input: PatternExtractionInput,
  llm: LLMProvider
): Promise<PatternReport> {
  // Step 1: Extract recurring patterns across all subjects
  const patternsRaw = await llm.complete(patternExtractor.buildPrompt(input));
  const allPatterns = patternExtractor.parseOutput(patternsRaw);

  // Step 2: Correlate patterns with market success — upgrades verdicts to 'good'
  const successRaw = await llm.complete(successAnalyst.buildPrompt(input, allPatterns));
  const successPatterns = successAnalyst.parseOutput(successRaw);

  // Step 3: Correlate patterns with market failure — upgrades verdicts to 'bad'
  const failureRaw = await llm.complete(failureAnalyst.buildPrompt(input, allPatterns));
  const failurePatterns = failureAnalyst.parseOutput(failureRaw);

  // Merge: success and failure analysts each return their subset; rebuild the full picture
  const goodPatterns = successPatterns.filter((p) => p.verdict === 'good');
  const badPatterns = failurePatterns.filter((p) => p.verdict === 'bad');

  // Neutral and context-dependent: patterns not captured by either analyst verdict
  const classifiedNames = new Set([
    ...goodPatterns.map((p) => p.name),
    ...badPatterns.map((p) => p.name),
  ]);
  const neutralPatterns = allPatterns.filter(
    (p) => !classifiedNames.has(p.name)
  );

  // Step 4: Synthesise narrative report with blind spots
  const synthesisRaw = await llm.complete(
    synthesisWriter.buildPrompt(input, goodPatterns, badPatterns, neutralPatterns)
  );
  const report = synthesisWriter.parseOutput(synthesisRaw, input, goodPatterns, badPatterns, neutralPatterns);

  return report;
}
