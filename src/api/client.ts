/**
 * API 客户端 - 封装所有后端 API 调用
 */

import { API_BASE_URL, API_ENDPOINTS, REQUEST_TIMEOUT } from './config';
import type {
  HealthResponse,
  AgentType,
  ChatRequest,
  ChatResponse,
  SessionListResponse,
  SessionDetailResponse,
  AgentListResponse,
  FileTreeNode,
  RegisterConfigResponse,
  SkillInfo,
  SkillDocResponse,
} from './types';

/**
 * 基础请求封装
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `请求失败: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('请求超时');
      }
      throw error;
    }
    throw new Error('未知错误');
  }
}

/**
 * API 客户端类
 */
export class ApiClient {
  // ============== 健康检查 ==============

  /**
   * 健康检查
   */
  async checkHealth(): Promise<HealthResponse> {
    return request<HealthResponse>(API_ENDPOINTS.health);
  }
}

// 导出单例实例
export const apiClient = new ApiClient();


/**
 * Agent API 客户端类
 */
export class AgentApiClient {
  // ============== 聊天相关 ==============

  /**
   * 发送聊天消息
   */
  async chat(
    message: string,
    sessionId?: string,
    agentType: AgentType = 'model',
    context?: Record<string, unknown>
  ): Promise<ChatResponse> {
    const chatRequest: ChatRequest = {
      message,
      session_id: sessionId,
      agent_type: agentType,
      context,
    };

    return request<ChatResponse>(API_ENDPOINTS.agentChat, {
      method: 'POST',
      body: JSON.stringify(chatRequest),
    });
  }

  /**
   * 发送聊天消息（SSE 流式响应）
   * 
   * @param message - 用户消息
   * @param sessionId - 会话 ID（可选）
   * @param agentType - Agent 类型
   * @param context - 额外上下文
   * @param onChunk - 接收增量内容的回调
   * @param onComplete - 完成时的回调
   * @param onError - 错误回调
   * @returns 取消函数
   */
  chatStream(
    message: string,
    sessionId: string | undefined,
    agentType: AgentType,
    onChunk: (content: string) => void,
    onComplete: (response: string, sessionId: string, title?: string, plan?: any) => void,
    onError: (error: string) => void,
    onQuestion?: (questionData: { text: string; options: string[]; allow_freeform?: boolean; context?: string; plan?: any; docker_tool?: any }) => void,
    onStatus?: (data: { node?: string; step_id?: number; status?: string; type: string }) => void,
    onSession?: (data: { session_id: string; db_chat_id?: number }) => void,
    projectId?: number,
  ): () => void {
    const chatRequest: ChatRequest = {
      message,
      session_id: sessionId,
      agent_type: agentType,
      project_id: projectId,
    };

    let aborted = false;
    let fullResponse = '';
    let receivedSessionId = sessionId || '';

    // 使用 POST 请求需要通过 URL 参数传递数据
    // 注意：由于 EventSource 不支持 POST，我们需要使用 fetch + ReadableStream
    const controller = new AbortController();
    
    const startStream = async () => {
      try {
        // 获取认证 token
        const token = authApiClient.getAccessToken();
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.agentChatStream}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(chatRequest),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error('Response body is null');
        }

        let lineBuffer = '';

        while (!aborted) {
          const { done, value } = await reader.read();
          
          if (done) {
            break;
          }

          const chunk = decoder.decode(value, { stream: true });
          // 将未完成的上一行拼接到当前 chunk
          const combined = lineBuffer + chunk;
          const lines = combined.split('\n');
          // 最后一个元素可能是不完整的行，保留到下次
          lineBuffer = lines.pop() || '';

          for (const line of lines) {
            if (aborted) break;
            
            if (line.startsWith('data:')) {
              try {
                const data = JSON.parse(line.substring(5).trim());
                
                // 处理会话 ID
                if (data.session_id) {
                  receivedSessionId = data.session_id;
                  if (onSession) {
                    onSession({ session_id: data.session_id, db_chat_id: data.db_chat_id });
                  }
                }
                
                // 处理消息 chunk
                if (data.type === 'chunk' && data.content) {
                  fullResponse += data.content;
                  onChunk(data.content);
                }
                // 处理节点状态更新（Think/Planner/Executor 等阶段提示）+ 工具调用事件
                else if (data.type === 'status' || data.type === 'step_update' || data.type === 'step_chunk' || data.type === 'tool_call' || data.type === 'node_output' || data.type === 'observe' || data.type === 'plan_update') {
                  if (onStatus) {
                    onStatus(data);
                  }
                }
                // 处理最终消息
                else if (data.type === 'final') {
                  const finalResponse = data.response || fullResponse;
                  const title = data.title || undefined;
                  onComplete(finalResponse, receivedSessionId, title, data.plan);
                  aborted = true;
                  break;
                }
                // 处理 Human-in-the-Loop 提问
                else if (data.type === 'question') {
                  if (onQuestion) {
                    onQuestion({
                      text: data.text || '',
                      options: data.options || [],
                      allow_freeform: data.allow_freeform,
                      context: data.context,
                      plan: data.plan,
                      docker_tool: data.docker_tool,
                    });
                  }
                  aborted = true;
                  break;
                }
                // 处理取消
                else if (data.type === 'cancelled') {
                  onComplete(fullResponse, receivedSessionId);
                  aborted = true;
                  break;
                }
                // 处理错误
                else if (data.error) {
                  onError(data.error);
                  aborted = true;
                  break;
                }
              } catch (e) {
                console.error('Failed to parse SSE data:', line, e);
              }
            }
          }
        }

        reader.releaseLock();
      } catch (error) {
        if (!aborted) {
          const errorMessage = error instanceof Error ? error.message : '未知错误';
          onError(errorMessage);
        }
      }
    };

    // 启动流式请求
    startStream();

    // 返回取消函数
    return () => {
      aborted = true;
      controller.abort();
    };
  }

  /**
   * 手动触发计划执行（SSE 流式响应）
   * 
   * 复用与 chatStream 相同的 SSE 事件格式和回调结构。
   * 
   * @param sessionId - 会话 ID（chat_id UUID）
   * @param stepIds - 要执行的步骤 ID 列表（null=所有 pending 步骤）
   * @param onChunk - 接收增量内容的回调
   * @param onComplete - 完成时的回调
   * @param onError - 错误回调
   * @param onStatus - 节点状态 / 步骤更新回调
   * @param onSession - 会话信息回调
   * @param projectId - 项目 ID
   * @returns 取消函数
   */
  executeStream(
    sessionId: string,
    stepIds: number[] | undefined,
    onChunk: (content: string) => void,
    onComplete: (response: string, sessionId: string, title?: string, plan?: any) => void,
    onError: (error: string) => void,
    onStatus?: (data: { node?: string; step_id?: number; status?: string; type: string }) => void,
    onSession?: (data: { session_id: string; db_chat_id?: number }) => void,
    projectId?: number,
  ): () => void {
    const body = {
      session_id: sessionId,
      step_ids: stepIds ?? null,
      project_id: projectId,
    };

    let aborted = false;
    let fullResponse = '';
    let receivedSessionId = sessionId;
    const controller = new AbortController();

    const startStream = async () => {
      try {
        const token = authApiClient.getAccessToken();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.agentExecute}`, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) throw new Error('Response body is null');

        let lineBuffer = '';

        while (!aborted) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const combined = lineBuffer + chunk;
          const lines = combined.split('\n');
          lineBuffer = lines.pop() || '';

          for (const line of lines) {
            if (aborted) break;
            if (line.startsWith('data:')) {
              try {
                const data = JSON.parse(line.substring(5).trim());

                if (data.session_id) {
                  receivedSessionId = data.session_id;
                  if (onSession) onSession({ session_id: data.session_id, db_chat_id: data.db_chat_id });
                }

                if (data.type === 'chunk' && data.content) {
                  fullResponse += data.content;
                  onChunk(data.content);
                } else if (data.type === 'status' || data.type === 'step_update' || data.type === 'step_chunk' || data.type === 'tool_call' || data.type === 'node_output' || data.type === 'observe' || data.type === 'plan_update') {
                  if (onStatus) onStatus(data);
                } else if (data.type === 'final') {
                  const finalResponse = data.response || fullResponse;
                  onComplete(finalResponse, receivedSessionId, data.title, data.plan);
                  aborted = true;
                  break;
                } else if (data.type === 'question') {
                  // Execute 流程中一般不会出现 question，但兼容处理
                  aborted = true;
                  break;
                } else if (data.type === 'cancelled') {
                  onComplete(fullResponse, receivedSessionId);
                  aborted = true;
                  break;
                } else if (data.error) {
                  onError(data.error);
                  aborted = true;
                  break;
                }
              } catch (e) {
                console.error('Failed to parse SSE data:', line, e);
              }
            }
          }
        }

        reader.releaseLock();
      } catch (error) {
        if (!aborted) {
          onError(error instanceof Error ? error.message : '未知错误');
        }
      }
    };

    startStream();
    return () => { aborted = true; controller.abort(); };
  }

  // ============== 会话管理 ==============

  /**
   * 获取所有会话列表
   */
  async getSessions(): Promise<SessionListResponse> {
    return request<SessionListResponse>(API_ENDPOINTS.agentSessions);
  }

  /**
   * 获取会话详情
   */
  async getSessionDetail(sessionId: string): Promise<SessionDetailResponse> {
    return request<SessionDetailResponse>(API_ENDPOINTS.agentSessionDetail(sessionId));
  }

  /**
   * 删除会话
   */
  async deleteSession(sessionId: string): Promise<{ success: boolean; message: string }> {
    return request(API_ENDPOINTS.agentSessionDetail(sessionId), {
      method: 'DELETE',
    });
  }

  /**
   * 重置会话
   */
  async resetSession(sessionId: string): Promise<{ success: boolean; message: string }> {
    return request(API_ENDPOINTS.agentSessionReset(sessionId), {
      method: 'POST',
    });
  }

  /**
   * 取消当前会话的执行（LLM 流式输出 / Executor 工具调用）
   */
  async cancelSession(sessionId: string): Promise<{ success: boolean; message: string }> {
    const token = authApiClient.getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return request(API_ENDPOINTS.agentCancel, {
      method: 'POST',
      body: JSON.stringify({ session_id: sessionId }),
      headers,
    });
  }

  /**
   * 获取会话的后台执行状态（idle / running / waiting_for_input / completed / error / cancelled）
   */
  async getSessionStatus(sessionId: string): Promise<{ execution_status: string; pending_question?: any }> {
    const token = authApiClient.getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return request<{ execution_status: string; pending_question?: any }>(
      API_ENDPOINTS.agentSessionStatus(sessionId),
      { headers }
    );
  }

  // ============== Agent 信息 ==============

  /**
   * 获取可用的 Agent 列表
   */
  async getAgents(): Promise<AgentListResponse> {
    return request<AgentListResponse>(API_ENDPOINTS.agentList);
  }
}

// 导出 Agent API 单例实例
export const agentApiClient = new AgentApiClient();


// ==================== 认证 API 客户端 ====================

import type {
  UserInfo,
  RegisterRequest,
  RegisterResponse,
  SendCodeResponse,
  LoginRequest,
  TokenResponse,
  RefreshRequest,
  PasswordChangeRequest,
  PasswordResetSubmit,
  MessageResponse,
} from './types';

// Token 存储 key
const ACCESS_TOKEN_KEY = 'bioagent_access_token';
const REFRESH_TOKEN_KEY = 'bioagent_refresh_token';
const USER_INFO_KEY = 'bioagent_user_info';

/**
 * 认证 API 客户端
 */
class AuthApiClient {
  // 刷新锁：防止并发刷新请求导致 token 被清除
  private refreshPromise: Promise<boolean> | null = null;

  /**
   * 保存 token 到 localStorage
   */
  saveTokens(tokens: TokenResponse): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
  }

  /**
   * 清除 token
   */
  clearTokens(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_INFO_KEY);
  }

  /**
   * 获取 access token
   */
  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  /**
   * 获取 refresh token
   */
  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  /**
   * 保存用户信息
   */
  saveUserInfo(user: UserInfo): void {
    localStorage.setItem(USER_INFO_KEY, JSON.stringify(user));
  }

  /**
   * 获取用户信息
   */
  getUserInfo(): UserInfo | null {
    const saved = localStorage.getItem(USER_INFO_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * 是否已登录
   */
  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }

  /**
   * 带认证的请求
   */
  private async authRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      // 如果是 401，尝试刷新 token
      if (response.status === 401 && this.getRefreshToken()) {
        const refreshed = await this.tryRefreshToken();
        if (refreshed) {
          // 重试请求
          headers['Authorization'] = `Bearer ${this.getAccessToken()}`;
          const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers,
          });
          if (retryResponse.ok) {
            return retryResponse.json();
          }
        }
      }
      
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `请求失败: ${response.status}`);
    }

    return response.json();
  }

  /**
   * 尝试刷新 token（带并发锁，避免多个请求同时刷新导致 token 被吊销）
   */
  private async tryRefreshToken(): Promise<boolean> {
    // 如果已有刷新请求在进行中，复用同一个 Promise
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;

    this.refreshPromise = (async () => {
      try {
        const tokens = await this.refresh({ refresh_token: refreshToken });
        this.saveTokens(tokens);
        return true;
      } catch {
        this.clearTokens();
        return false;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  /**
   * 发送验证码
   */
  async sendCode(email: string): Promise<SendCodeResponse> {
    return request<SendCodeResponse>(API_ENDPOINTS.authSendCode, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  /**
   * 获取注册配置（是否需要邀请码）
   */
  async getRegisterConfig(): Promise<RegisterConfigResponse> {
    return request<RegisterConfigResponse>(API_ENDPOINTS.authRegisterConfig);
  }

  /**
   * 用户注册
   */
  async register(data: RegisterRequest): Promise<RegisterResponse> {
    return request<RegisterResponse>(API_ENDPOINTS.authRegister, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * 用户登录
   */
  async login(data: LoginRequest): Promise<TokenResponse> {
    const tokens = await request<TokenResponse>(API_ENDPOINTS.authLogin, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    this.saveTokens(tokens);
    
    // 获取并保存用户信息
    const user = await this.getMe();
    this.saveUserInfo(user);
    
    return tokens;
  }

  /**
   * 刷新 token
   */
  async refresh(data: RefreshRequest): Promise<TokenResponse> {
    return request<TokenResponse>(API_ENDPOINTS.authRefresh, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * 用户登出
   */
  async logout(): Promise<MessageResponse> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      this.clearTokens();
      return { message: '已登出', success: true };
    }

    try {
      const result = await this.authRequest<MessageResponse>(API_ENDPOINTS.authLogout, {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      this.clearTokens();
      return result;
    } catch {
      this.clearTokens();
      return { message: '已登出', success: true };
    }
  }

  /**
   * 获取当前用户信息
   */
  async getMe(): Promise<UserInfo> {
    return this.authRequest<UserInfo>(API_ENDPOINTS.authMe);
  }

  /**
   * 修改密码
   */
  async changePassword(data: PasswordChangeRequest): Promise<MessageResponse> {
    return this.authRequest<MessageResponse>(API_ENDPOINTS.authChangePassword, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * 发送密码重置验证码
   */
  async sendResetCode(email: string): Promise<SendCodeResponse> {
    return request<SendCodeResponse>(API_ENDPOINTS.authSendResetCode, {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  /**
   * 重置密码
   */
  async resetPassword(data: PasswordResetSubmit): Promise<MessageResponse> {
    return request<MessageResponse>(API_ENDPOINTS.authResetPassword, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

// 导出认证 API 单例实例
export const authApiClient = new AuthApiClient();


// ==================== 对话持久化 API 客户端 ====================

import type {
  ChatSessionCreate,
  ChatSessionUpdate,
  ChatSessionResponse,
  ChatSessionDetailResponse,
  ChatSessionListResponse,
  ChatMessageCreate,
  ChatMessageResponse,
  ChatStatsResponse,
  ProjectCreate,
  ProjectUpdate,
  ProjectResponse,
  ProjectListResponse,
} from './types';

/**
 * 对话持久化 API 客户端
 * 
 * 适配新的 /api/conversations 端点
 */
class ChatApiClient {
  /**
   * 带认证的请求
   */
  private async authRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = authApiClient.getAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `请求失败: ${response.status}`);
    }

    return response.json();
  }

  // ============== 对话管理 ==============

  /**
   * 获取对话列表
   * 后端返回 { conversations: [...], total: N }
   */
  async getSessions(
    limit: number = 100,
    offset: number = 0,
    _activeOnly: boolean = true
  ): Promise<ChatSessionResponse[]> {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    const resp = await this.authRequest<ChatSessionListResponse>(
      `${API_ENDPOINTS.conversations}?${params}`
    );
    return resp.chats;
  }

  /**
   * 创建新对话
   */
  async createSession(data: ChatSessionCreate = {}): Promise<ChatSessionResponse> {
    return this.authRequest<ChatSessionResponse>(API_ENDPOINTS.conversations, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * 获取对话详情（包含消息）
   */
  async getSession(sessionId: number): Promise<ChatSessionDetailResponse> {
    return this.authRequest<ChatSessionDetailResponse>(
      API_ENDPOINTS.conversationDetail(sessionId)
    );
  }

  /**
   * 更新对话标题
   */
  async updateSession(
    sessionId: number,
    data: ChatSessionUpdate
  ): Promise<ChatSessionResponse> {
    return this.authRequest<ChatSessionResponse>(
      API_ENDPOINTS.conversationDetail(sessionId),
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      }
    );
  }

  /**
   * 删除对话（软删除），可选同时删除关联文件
   */
  async deleteSession(sessionId: number, deleteFiles: boolean = false): Promise<{ message: string }> {
    const params = new URLSearchParams();
    if (deleteFiles) params.set('delete_files', 'true');
    const query = params.toString();
    const url = query
      ? `${API_ENDPOINTS.conversationDetail(sessionId)}?${query}`
      : API_ENDPOINTS.conversationDetail(sessionId);
    return this.authRequest<{ message: string }>(
      url,
      {
        method: 'DELETE',
      }
    );
  }

  // ============== 消息管理 ==============

  /**
   * 获取对话消息（分页）
   * 后端返回 MessageResponse[]
   */
  async getMessages(
    sessionId: number,
    limit: number = 100,
    offset: number = 0
  ): Promise<ChatMessageResponse[]> {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    return this.authRequest<ChatMessageResponse[]>(
      `${API_ENDPOINTS.conversationMessages(sessionId)}?${params}`
    );
  }

  /**
   * 添加消息到对话
   */
  async addMessage(
    sessionId: number,
    data: ChatMessageCreate
  ): Promise<ChatMessageResponse> {
    return this.authRequest<ChatMessageResponse>(
      API_ENDPOINTS.conversationMessages(sessionId),
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  }

  // ============== 执行计划 ==============

  /**
   * 获取对话最新执行计划（可携带 agent session_id 以获取执行状态）
   */
  async getLatestPlan(chatPk: number, agentSessionId?: string): Promise<{ plan: any | null; execution_status?: string }> {
    let url = API_ENDPOINTS.conversationPlan(chatPk);
    if (agentSessionId) {
      url += `?session_id=${encodeURIComponent(agentSessionId)}`;
    }
    return this.authRequest<{ plan: any | null; execution_status?: string }>(url);
  }

  /**
   * 获取对话的各节点输出摘要（历史加载）
   */
  async getNodeOutputs(sessionId: number): Promise<{
    node_outputs: Array<{ node: string; content: string }>;
    node_outputs_by_msg?: Record<string, Array<{ node: string; content: string }>>;
  }> {
    return this.authRequest<{
      node_outputs: Array<{ node: string; content: string }>;
      node_outputs_by_msg?: Record<string, Array<{ node: string; content: string }>>;
    }>(
      API_ENDPOINTS.conversationNodeOutputs(sessionId)
    );
  }

  /**
   * 获取对话的 Executor 工具调用日志（按 step_id 分组）
   */
  async getToolLogs(chatPk: number): Promise<{
    tool_logs: Record<string, Array<{
      id: string;
      tool: string;
      arguments: Record<string, any>;
      success: boolean;
      output: string;
      error?: string;
      duration_ms?: number;
    }>>;
  }> {
    return this.authRequest(API_ENDPOINTS.conversationToolLogs(chatPk));
  }

  // ============== 统计信息 ==============

  /**
   * 获取对话统计
   */
  async getStats(): Promise<ChatStatsResponse> {
    return this.authRequest<ChatStatsResponse>(API_ENDPOINTS.conversationStats);
  }

  // ============== 批量操作 ==============

  /**
   * 同步本地对话到服务器（迁移用）
   */
  async syncLocalChats(
    localChats: Array<{
      title: string;
      messages: Array<{ role: 'user' | 'assistant'; content: string }>;
      createdAt: string;
    }>
  ): Promise<{ imported: number; failed: number }> {
    let imported = 0;
    let failed = 0;

    for (const chat of localChats) {
      try {
        const session = await this.createSession({
          title: chat.title,
        });

        for (const msg of chat.messages) {
          await this.addMessage(session.id, {
            role: msg.role,
            content: msg.content,
          });
        }

        imported++;
      } catch (error) {
        console.error('导入对话失败:', error);
        failed++;
      }
    }

    return { imported, failed };
  }

  // ============== 项目管理 ==============

  /**
   * 获取项目列表
   */
  async getProjects(limit: number = 100, offset: number = 0): Promise<ProjectResponse[]> {
    const params = new URLSearchParams({
      limit: String(limit),
      offset: String(offset),
    });
    const resp = await this.authRequest<ProjectListResponse>(
      `${API_ENDPOINTS.projects}?${params}`
    );
    return resp.projects;
  }

  /**
   * 创建项目
   */
  async createProject(data: ProjectCreate): Promise<ProjectResponse> {
    return this.authRequest<ProjectResponse>(API_ENDPOINTS.projects, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * 更新项目
   */
  async updateProject(projectId: number, data: ProjectUpdate): Promise<ProjectResponse> {
    return this.authRequest<ProjectResponse>(
      API_ENDPOINTS.projectDetail(projectId),
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );
  }

  /**
   * 删除项目
   */
  async deleteProject(projectId: number): Promise<{ message: string }> {
    return this.authRequest<{ message: string }>(
      API_ENDPOINTS.projectDetail(projectId),
      {
        method: 'DELETE',
      }
    );
  }

  // ============== 文件浏览 ==============

  /**
   * 获取文件树（懒加载，每次返回一层目录）
   */
  async getFileTree(path?: string): Promise<FileTreeNode[]> {
    const params = new URLSearchParams();
    if (path) params.set('path', path);
    const query = params.toString();
    const url = query ? `${API_ENDPOINTS.fileTree}?${query}` : API_ENDPOINTS.fileTree;
    return this.authRequest<FileTreeNode[]>(url);
  }

  /**
   * 获取所有文件（扁平列表，用于 @mention 搜索）
   */
  async listAllFiles(): Promise<FileTreeNode[]> {
    return this.authRequest<FileTreeNode[]>(API_ENDPOINTS.fileListAll);
  }

  /**
   * 获取文件下载 URL
   */
  getFileDownloadUrl(path: string): string {
    const params = new URLSearchParams({ path });
    const token = authApiClient.getAccessToken();
    if (token) params.set('token', token);
    return `${API_BASE_URL}${API_ENDPOINTS.fileDownload}?${params}`;
  }

  /**
   * 下载文件（触发浏览器下载）
   */
  async downloadFile(path: string): Promise<void> {
    const token = authApiClient.getAccessToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const params = new URLSearchParams({ path });
    const resp = await fetch(`${API_BASE_URL}${API_ENDPOINTS.fileDownload}?${params}`, { headers });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ detail: resp.statusText }));
      throw new Error(err.detail || '下载失败');
    }
    const blob = await resp.blob();
    const filename = path.split('/').pop() || 'download';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  /**
   * 删除文件或目录
   */
  async deleteFile(path: string): Promise<{ message: string; path: string }> {
    const params = new URLSearchParams({ path });
    return this.authRequest<{ message: string; path: string }>(
      `${API_ENDPOINTS.fileDelete}?${params}`,
      { method: 'DELETE' },
    );
  }

  /**
   * 移动/重命名文件或目录
   */
  async moveFile(src: string, dest: string): Promise<{ message: string; src: string; dest: string }> {
    return this.authRequest<{ message: string; src: string; dest: string }>(
      API_ENDPOINTS.fileMove,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ src, dest }),
      },
    );
  }

  /**
   * 创建空文件
   */
  async createFile(path: string): Promise<{ message: string; path: string }> {
    return this.authRequest<{ message: string; path: string }>(
      API_ENDPOINTS.fileCreate,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      },
    );
  }

  /**
   * 创建目录
   */
  async createDirectory(path: string): Promise<{ message: string; path: string }> {
    return this.authRequest<{ message: string; path: string }>(
      API_ENDPOINTS.fileMkdir,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
      },
    );
  }

  /**
   * 检查会话是否有关联文件
   */
  async checkConversationFiles(sessionId: number): Promise<{ has_files: boolean; file_count: number; dir_path: string | null }> {
    return this.authRequest<{ has_files: boolean; file_count: number; dir_path: string | null }>(
      API_ENDPOINTS.conversationFiles(sessionId)
    );
  }

  // ============== 文件分片上传 ==============

  /**
   * 分片上传文件
   * @param file - 要上传的文件
   * @param options - 上传选项（projectId, conversationId）
   * @param onProgress - 进度回调 (0-100)
   * @returns 上传结果
   */
  async uploadFile(
    file: File,
    options: { projectId?: number; conversationId?: number; sessionId?: string } = {},
    onProgress?: (percent: number) => void,
  ): Promise<{ file_path: string; filename: string; total_size: number; conversation_id?: number }> {
    const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB per chunk
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    const token = authApiClient.getAccessToken();
    const authHeaders: Record<string, string> = {};
    if (token) authHeaders['Authorization'] = `Bearer ${token}`;

    // 1. 初始化上传
    const initResp = await fetch(`${API_BASE_URL}${API_ENDPOINTS.uploadChunkInit}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({
        filename: file.name,
        total_size: file.size,
        total_chunks: totalChunks,
        chunk_size: CHUNK_SIZE,
        conversation_id: options.conversationId ?? null,
        project_id: options.projectId ?? null,
        session_id: options.sessionId ?? null,
      }),
    });
    if (!initResp.ok) {
      const err = await initResp.json().catch(() => ({ detail: initResp.statusText }));
      throw new Error(err.detail || '初始化上传失败');
    }
    const { upload_id } = await initResp.json();

    // 2. 逐片上传
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const blob = file.slice(start, end);

      const form = new FormData();
      form.append('chunk', blob, `chunk_${i}`);
      form.append('upload_id', upload_id);
      form.append('chunk_index', String(i));

      const chunkResp = await fetch(`${API_BASE_URL}${API_ENDPOINTS.uploadChunk}`, {
        method: 'PUT',
        headers: { ...authHeaders },
        body: form,
      });
      if (!chunkResp.ok) {
        const err = await chunkResp.json().catch(() => ({ detail: chunkResp.statusText }));
        throw new Error(err.detail || `分片 ${i} 上传失败`);
      }
      onProgress?.(Math.round(((i + 1) / totalChunks) * 100));
    }

    // 3. 合并
    const completeResp = await fetch(`${API_BASE_URL}${API_ENDPOINTS.uploadChunkComplete}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({
        upload_id,
        filename: file.name,
        add_to_conversation: !!options.conversationId,
      }),
    });
    if (!completeResp.ok) {
      const err = await completeResp.json().catch(() => ({ detail: completeResp.statusText }));
      throw new Error(err.detail || '文件合并失败');
    }
    const result = await completeResp.json();
    return {
      file_path: result.file_path,
      filename: result.filename,
      total_size: result.total_size,
      conversation_id: result.conversation_id,
    };
  }

  // ============== 技能库 ==============

  /** 列出全部内置 domain 流程 */
  async listSkillDomains(): Promise<SkillInfo[]> {
    return this.authRequest<SkillInfo[]>(API_ENDPOINTS.skillDomains);
  }

  /** 列出全部内置 module 模块 */
  async listSkillModules(): Promise<SkillInfo[]> {
    return this.authRequest<SkillInfo[]>(API_ENDPOINTS.skillModules);
  }

  /** 读取内置文档（domain 或 module）的 Markdown 内容 */
  async getSkillDoc(type: 'domain' | 'module', name: string): Promise<SkillDocResponse> {
    const params = new URLSearchParams({ type, name });
    return this.authRequest<SkillDocResponse>(`${API_ENDPOINTS.skillDoc}?${params}`);
  }

  /** 列出用户自定义技能 */
  async listUserSkills(): Promise<SkillInfo[]> {
    return this.authRequest<SkillInfo[]>(API_ENDPOINTS.skillUser);
  }

  /** 读取用户自定义技能内容 */
  async getUserSkillDoc(name: string): Promise<SkillDocResponse> {
    const params = new URLSearchParams({ name });
    return this.authRequest<SkillDocResponse>(`${API_ENDPOINTS.skillUserDoc}?${params}`);
  }

  /** 创建或更新用户自定义技能 */
  async saveUserSkill(name: string, content: string): Promise<{ message: string; name: string }> {
    return this.authRequest(`${API_ENDPOINTS.skillUser}`, {
      method: 'POST',
      body: JSON.stringify({ name, content }),
    });
  }

  /** 删除用户自定义技能 */
  async deleteUserSkill(name: string): Promise<{ message: string }> {
    const params = new URLSearchParams({ name });
    return this.authRequest(`${API_ENDPOINTS.skillUser}?${params}`, { method: 'DELETE' });
  }

  /** 管理员: 编辑内置文档 */
  async updateAdminDoc(type: 'domain' | 'module', name: string, content: string): Promise<{ message: string }> {
    return this.authRequest(`${API_ENDPOINTS.skillAdminDoc}`, {
      method: 'PUT',
      body: JSON.stringify({ type, name, content }),
    });
  }
}

// 导出对话 API 单例实例
export const chatApiClient = new ChatApiClient();


// 默认导出建模客户端（保持向后兼容）
export default apiClient;
