// Message types
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isAgentWorking?: boolean;
  thinkingStatus?: string;         // 当前思考阶段（如"正在思考..."“正在规划..."）
  agentWorkDetails?: AgentWorkStep[];
  // 新增：绘图和 MCP 相关
  imageBase64?: string;            // 生成的图片 (base64)
  generatedScript?: string;        // 生成的脚本
  mcpPendingConfig?: McpConfig;    // MCP 待确认配置
  // Human-in-the-Loop 提问
  questionData?: QuestionData;
  nodeOutputs?: NodeOutputInfo[];
}

// Human-in-the-Loop 提问数据
export interface QuestionData {
  text: string;
  options: string[];
  allow_freeform?: boolean;
  context?: string;
  plan?: PlanData;
  docker_tool?: {            // Docker 工具确认
    image?: string;
    command?: string;
    workdir?: string;
  };
}

// 执行计划
export interface PlanStep {
  step_id: number;
  description: string;
  depend_on: number | null;
  expected_output: string;
  reference: string[] | null;
  required_params: Record<string, string> | null;
  optional_params: Record<string, string> | null;
  status: 'pending' | 'running' | 'complete' | 'error' | 'skipped' | 'cancelled';
  output: string | null;
}

export interface PlanData {
  goal: string;
  choices?: Record<string, string>;
  steps: PlanStep[];
  /** @deprecated backward compat — use `steps` */
  plan?: PlanStep[];
}

/** Normalize plan data from backend (handles both `steps` and legacy `plan` key) */
export function normalizePlanData(raw: any): PlanData | null {
  if (!raw || typeof raw !== 'object') return null;
  const steps = raw.steps || raw.plan;
  if (!Array.isArray(steps)) return null;
  return { ...raw, steps, plan: undefined };
}

// Executor 步骤实时输出
export interface StepOutput {
  step_id: number;
  content: string;
  status: 'running' | 'complete' | 'error' | 'skipped' | 'cancelled';
}

// 单次工具调用信息（Executor ReAct 循环中的每次 tool call）
export interface ToolCallInfo {
  id: string;               // 唯一标识 (step_id-round_idx 格式)
  tool: string;             // 工具名称
  arguments: Record<string, any>;
  status: 'running' | 'complete' | 'error';
  output?: string;
  error?: string | null;
  duration_ms?: number;
  isDocker?: boolean;       // 是否为 Docker 外部容器调用
  // Observe 评估结果（由独立 LLM 评估工具执行结果后附加）
  observeDecision?: 'continue' | 'retry' | 'fail';
  observeReason?: string;
}

// 节点输出信息（Think/Planner/Executor/Reviewer 的关键摘要）
export interface NodeOutputInfo {
  node: string;
  content: string;
}

// 引用文件（聊天中通过 @ 或工作区点选的文件）
export interface ReferencedFile {
  name: string;           // 文件名（如 panel_info.xlsx）
  workspacePath: string;  // 沙箱内相对路径（如 uploads/panel_info.xlsx）
  source: 'upload' | 'workspace';
}

// MCP 待确认配置
export interface McpConfig {
  server: string;
  tool: string;
  config: Record<string, any>;
  description?: string;
}

// Agent work step
export interface AgentWorkStep {
  id: string;
  type: 'thinking' | 'tool_call' | 'result' | 'error' | 'receiving' | 'responding';
  title: string;
  content: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  timestamp: Date;
}

// Chat session
export interface ChatSession {
  id: string;
  chatId?: string; // 后端 chats.chat_id (UUID)，用于恢复 agent 会话
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  moduleType?: ModuleType;
  projectId?: string; // 所属项目ID
}

// Project
export interface Project {
  id: string;
  name: string;
  description?: string;
  autoExecute?: boolean;
  chats: ChatSession[];
  createdAt: Date;
  updatedAt: Date;
}

// Module types
export type ModuleType = 'chat' | 'statistics';

// Module info
export interface ModuleInfo {
  id: ModuleType;
  name: string;
  icon: string;
  description: string;
}

// User
export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

// App State
export interface AppState {
  currentModule: ModuleType;
  currentChat: ChatSession | null;
  currentProject: Project | null;
  projects: Project[];
  chatHistory: ChatSession[];
  isAgentPanelOpen: boolean;
  currentAgentWork: AgentWorkStep[];
  user: User | null;
  isSidebarCollapsed: boolean;
}
