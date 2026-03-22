/**
 * API 响应类型定义
 */

// ============== 算法相关 ==============

export interface AlgorithmParameter {
  name: string;
  label: string;
  type: 'number' | 'select' | 'boolean' | 'text';
  default: string | number | boolean | null;
  description: string;
  options?: Array<{ label: string; value: string }>;
  min_value?: number;
  max_value?: number;
  step?: number;
}

export interface AlgorithmInfo {
  id: string;
  name: string;
  name_en: string;
  description: string;
  category: string;
  tags: string[];
  parameters: AlgorithmParameter[];
}

export interface AlgorithmListResponse {
  algorithms: AlgorithmInfo[];
  total: number;
}

// ============== 数据上传相关 ==============

export interface ColumnInfo {
  name: string;
  dtype: string;
  missing_count: number;
  unique_count: number;
  sample_values: unknown[];
}

export interface DataInfo {
  file_id: string;
  file_path: string;
  filename: string;
  rows: number;
  columns: number;
  column_names: string[];
  column_info: ColumnInfo[];
  numeric_columns: string[];
  categorical_columns: string[];
  missing_total: number;
  preview: Record<string, unknown>[];
}

export interface DataUploadResponse {
  success: boolean;
  message: string;
  data: DataInfo | null;
}

// ============== 训练相关 ==============

export interface PreprocessingConfig {
  handle_missing: 'mean' | 'median' | 'mode' | 'drop' | 'zero';
  encode_categorical: 'onehot' | 'label';
  scale_features: 'standard' | 'minmax' | 'robust' | null;
}

export interface TrainRequest {
  file_id: string;
  algorithm_id: string;
  target_column: string;
  feature_columns?: string[];
  parameters: Record<string, unknown>;
  preprocessing: PreprocessingConfig;
  test_size: number;
  random_state: number;
}

export interface TrainResponse {
  success: boolean;
  message: string;
  task_id: string | null;
}

// ============== 任务状态相关 ==============

export type TaskStatusEnum = 'pending' | 'running' | 'completed' | 'failed';

export interface TaskStatus {
  task_id: string;
  status: TaskStatusEnum;
  progress: number;
  message: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface MetricsResult {
  task_type: 'classification' | 'regression' | 'clustering';
  // 分类指标
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1_score?: number;
  auc_roc?: number;
  confusion_matrix?: number[][];
  // 回归指标
  mse?: number;
  rmse?: number;
  mae?: number;
  r2?: number;
  // 聚类指标
  silhouette_score?: number;
  calinski_harabasz_score?: number;
  davies_bouldin_score?: number;
  // 额外数据
  roc_curve?: { fpr: number[]; tpr: number[]; thresholds: number[] };
  feature_importance?: Record<string, number>;
}

// 图表信息
export interface PlotInfo {
  base64: string;
  filename: string;
}

export interface PlotsResult {
  roc_curve?: PlotInfo;
  confusion_matrix?: PlotInfo;
  pr_curve?: PlotInfo;
  feature_importance?: PlotInfo;
  regression_plot?: PlotInfo;
  residual_plot?: PlotInfo;
}

export interface TaskResult {
  task_id: string;
  status: TaskStatusEnum;
  algorithm_id: string;
  algorithm_name: string;
  metrics: MetricsResult | null;
  training_time: number | null;
  model_path: string | null;
  plots?: PlotsResult | null;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

// ============== 预测相关 ==============

export interface PredictRequest {
  task_id: string;
  data: Record<string, unknown>[];
}

export interface PredictResponse {
  success: boolean;
  predictions: unknown[] | null;
  probabilities: number[][] | null;
  message: string | null;
}

// ============== 通用响应 ==============

export interface ApiError {
  detail: string;
}

export interface HealthResponse {
  status: string;
  message: string;
  timestamp: string;
  version?: string;
}

// ============== Agent 相关 ==============

export type AgentType = 'model' | 'bio' | 'figure';

export interface AgentInfo {
  type: AgentType;
  name: string;
  description: string;
  icon: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

export interface AgentStatus {
  state: string;
  task_type?: string | null;
  data_loaded?: boolean;
  algorithm_selected?: boolean;
  training_completed?: boolean;
  error?: string;
}

export interface AgentWorkStep {
  id: string;
  type: 'thinking' | 'tool_call' | 'responding' | 'receiving' | 'error';
  title: string;
  content: string;
  status: 'pending' | 'running' | 'completed' | 'error';
  timestamp: string;
}

export interface ChatRequest {
  message: string;
  session_id?: string;
  agent_type?: AgentType;
  context?: Record<string, unknown>;
  project_id?: number;
}

export interface ChatResponse {
  session_id: string;
  message: ChatMessage;
  agent_status: AgentStatus;
  work_steps: AgentWorkStep[];
  training_result?: TaskResult | null;  // 训练结果（包含指标和图表）
  image_base64?: string | null;         // 生成的图片 (base64 png)
  generated_script?: string | null;     // 生成的绘图脚本
  mcp_pending_config?: Record<string, any> | null;  // MCP 等待确认的配置
}

export interface SessionInfo {
  session_id: string;
  agent_type: AgentType;
  created_at: string;
  updated_at: string;
  message_count: number;
  status: string;
}

export interface SessionListResponse {
  sessions: SessionInfo[];
  total: number;
}

export interface SessionDetailResponse {
  session_id: string;
  agent_type: AgentType;
  messages: ChatMessage[];
  work_steps: AgentWorkStep[];
  created_at: string;
  updated_at: string;
  status: string;
}

export interface AgentListResponse {
  agents: AgentInfo[];
}

// ============== 认证相关 ==============

export interface UserInfo {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
  email_verified: boolean;
  role: string;       // admin, manager, user
  vip: string;        // regular, pro, team
  created_at: string;
  updated_at: string;
}

export interface SendCodeRequest {
  email: string;
}

export interface SendCodeResponse {
  message: string;
  success: boolean;
  expires_in: number;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  code: string;
  invitation_code?: string;
}

export interface RegisterResponse {
  user: UserInfo;
  message: string;
}

export interface RegisterConfigResponse {
  invitation_code_required: boolean;
  registration_full?: boolean;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface RefreshRequest {
  refresh_token: string;
}

export interface PasswordChangeRequest {
  old_password: string;
  new_password: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetSubmit {
  email: string;
  code: string;
  new_password: string;
}

export interface MessageResponse {
  message: string;
  success: boolean;
}

// ============== 对话持久化相关（新 conversations API） ==============

export interface ChatSessionCreate {
  project_id?: number;
  title?: string;
  chat_id?: string;
}

export interface ChatSessionUpdate {
  title?: string;
  project_id?: number | null;
}

export interface ChatSessionResponse {
  id: number;
  project_id: number | null;
  title: string | null;
  chat_id: string | null;
  message_count: number;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageCreate {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
}

export interface ChatMessageResponse {
  id: number;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  created_at: string;
}

export interface ChatSessionDetailResponse extends ChatSessionResponse {
  messages: ChatMessageResponse[];
}

export interface ChatSessionListResponse {
  chats: ChatSessionResponse[];
  total: number;
}

export interface ChatMessagesResponse {
  messages: ChatMessageResponse[];
  total: number;
}

export interface ChatStatsResponse {
  total_conversations: number;
  user_id: number;
  project_id?: number;
}

// ============== 项目管理相关 ==============

export interface ProjectCreate {
  name: string;
  description?: string;
}

export interface ProjectUpdate {
  name?: string;
  description?: string;
  auto_execute?: boolean;
}

export interface ProjectResponse {
  id: number;
  name: string;
  description: string | null;
  auto_execute: boolean;
  created_at: string;
  updated_at: string;
  conversation_count: number;
}

export interface ProjectListResponse {
  projects: ProjectResponse[];
  total: number;
}

// ============== 技能库相关 ==============

export interface SkillInfo {
  name: string;
  description: string;
  type: 'domain' | 'module' | 'user';
}

export interface SkillDocResponse {
  name: string;
  type: string;
  content: string;
}

// ============== 文件浏览相关 ==============

export interface FileTreeNode {
  name: string;
  type: 'file' | 'dir';
  path: string;
  size?: number;
  modified?: number;
}

// ============== 支付相关 ==============

export interface RechargeRequest {
  amount: number;
  credit_amount: number;
  payment_method: 'wechat' | 'alipay';
}

export interface SubscribeRequest {
  plan_type: 'pro';
  payment_method: 'wechat' | 'alipay';
}

export interface PaymentInitResponse {
  order_no: string;
  amount: number;
  payment_method: string;
  code_url?: string | null;
  pay_url?: string | null;
}

export interface OrderResponse {
  id: number;
  order_no: string;
  user_id: number;
  order_type: string;
  plan_type: string;
  amount: number;
  credit_amount?: number | null;
  status: string;  // pending | paid | expired | refunded | cancelled
  payment_method?: string | null;
  payment_trade_no?: string | null;
  paid_at?: string | null;
  expired_at: string;
  created_at: string;
  updated_at: string;
}

export interface OrderListResponse {
  orders: OrderResponse[];
  total: number;
}

export interface SubscriptionResponse {
  id: number;
  user_id: number;
  plan_type: string;
  status: string;  // active | expired | cancelled
  current_period_start: string;
  current_period_end: string;
  auto_renew: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserBalanceResponse {
  user_id: number;
  credit_balance: number;
  vip: string;
}
