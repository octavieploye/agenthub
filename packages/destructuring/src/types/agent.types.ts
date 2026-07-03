export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMProvider {
  complete(messages: LLMMessage[]): Promise<string>;
}

export interface AgentResult<T> {
  data: T;
  raw: string;
  agentId: string;
  timestamp: string;
}

export type PromptBuilder<TInput> = (input: TInput) => LLMMessage[];
export type OutputParser<TOutput> = (raw: string) => TOutput;
