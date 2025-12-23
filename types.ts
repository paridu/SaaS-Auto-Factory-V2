export enum AgentStatus {
  IDLE = 'IDLE',
  THINKING = 'THINKING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED'
}

export interface IdeaInput {
  name: string;
  targetUser: string;
  painPoint: string;
  description: string;
}

export interface RadarResult {
  score: number;
  reasoning: string;
  decision: 'PROCEED' | 'KILL';
  rawOutput: string;
}

export interface ProductResult {
  prd: string;
  features: string[];
  optimizations?: string;
  userFlow?: string;
  techSpec?: string;
}

export interface TechResult {
  stack: string;
  schema: string;
  apiSpec: string;
  fullOutput: string;
}

export interface DevResult {
  codeStructure: string;
  instructions: string;
}

export interface QAMetrics {
  users: number;
  retention: string;
  revenue: string;
  feedback: string;
}

export interface QAResult {
  decision: 'ITERATE' | 'PIVOT' | 'KILL';
  analysis: string;
}

export interface FactoryState {
  currentStage: number;
  idea: IdeaInput;
  radar: { status: AgentStatus; result: RadarResult | null };
  product: { status: AgentStatus; result: ProductResult | null };
  tech: { status: AgentStatus; result: TechResult | null };
  dev: { status: AgentStatus; result: DevResult | null };
  qa: { status: AgentStatus; metrics: QAMetrics; result: QAResult | null };
}

export const INITIAL_STATE: FactoryState = {
  currentStage: 0,
  idea: { name: '', targetUser: '', painPoint: '', description: '' },
  radar: { status: AgentStatus.IDLE, result: null },
  product: { status: AgentStatus.IDLE, result: null },
  tech: { status: AgentStatus.IDLE, result: null },
  dev: { status: AgentStatus.IDLE, result: null },
  qa: { status: AgentStatus.IDLE, metrics: { users: 0, retention: '', revenue: '', feedback: '' }, result: null },
};