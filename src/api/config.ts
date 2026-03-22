/**
 * API 配置
 */

// 后端 API 基础 URL
// 自动检测：如果没有设置环境变量，则使用当前页面的主机名
const getApiBaseUrl = (): string => {
  // 优先使用环境变量
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  
  // 开发环境：使用当前主机名 + 后端端口
  // 这样内网访问时会自动使用正确的 IP
  const hostname = window.location.hostname;
  const backendPort = 8081;
  
  // 如果是 localhost 或 127.0.0.1，直接使用
  // 否则使用当前主机名（适用于内网 IP 访问）
  return `http://${hostname}:${backendPort}`;
};

export const API_BASE_URL = getApiBaseUrl();

// API 端点
export const API_ENDPOINTS = {
  // 健康检查
  health: '/api/health',
  healthDetailed: '/api/health/detailed',
  
  // Agent 相关
  agentChat: '/api/agent/chat',
  agentChatStream: '/api/agent/chat/stream',
  agentExecute: '/api/agent/chat/execute',
  agentCancel: '/api/agent/cancel',
  agentSessions: '/api/agent/sessions',
  agentSessionDetail: (sessionId: string) => `/api/agent/sessions/${sessionId}`,
  agentSessionReset: (sessionId: string) => `/api/agent/sessions/${sessionId}/reset`,
  agentSessionStatus: (sessionId: string) => `/api/agent/session/${sessionId}/status`,
  agentList: '/api/agent/agents',
  
  // 对话持久化相关（新 API）
  conversations: '/api/conversations',
  conversationDetail: (id: number) => `/api/conversations/${id}`,
  conversationMessages: (id: number) => `/api/conversations/${id}/messages`,
  conversationSearch: '/api/conversations/search/messages',
  conversationStats: '/api/conversations/stats/overview',
  conversationPlan: (id: number) => `/api/conversations/${id}/plan`,
  conversationNodeOutputs: (id: number) => `/api/conversations/${id}/node-outputs`,
  conversationToolLogs: (id: number) => `/api/conversations/${id}/tool-logs`,
  
  // 项目管理
  projects: '/api/projects',
  projectDetail: (id: number) => `/api/projects/${id}`,
  
  // 文件浏览
  fileTree: '/api/files/tree',
  fileDownload: '/api/files/download',
  fileDelete: '/api/files',
  fileMove: '/api/files/move',
  fileCreate: '/api/files/create',
  fileMkdir: '/api/files/mkdir',
  fileListAll: '/api/files/list-all',

  // 会话文件检查
  conversationFiles: (id: number) => `/api/conversations/${id}/files`,

  // 文件上传
  uploadChunkInit: '/api/upload/chunk',
  uploadChunk: '/api/upload/chunk',
  uploadChunkComplete: '/api/upload/chunk/complete',
  
  // 认证相关
  authRegisterConfig: '/api/auth/register-config',
  authSendCode: '/api/auth/send-code',
  authRegister: '/api/auth/register',
  authLogin: '/api/auth/login',
  authRefresh: '/api/auth/refresh',
  authLogout: '/api/auth/logout',
  authMe: '/api/auth/me',
  authChangePassword: '/api/auth/change-password',
  authSendResetCode: '/api/auth/send-reset-code',
  authResetPassword: '/api/auth/reset-password',

  // 技能库
  skillDomains: '/api/skills/domains',
  skillModules: '/api/skills/modules',
  skillDoc: '/api/skills/doc',
  skillUser: '/api/skills/user',
  skillUserDoc: '/api/skills/user/doc',
  skillAdminDoc: '/api/skills/admin/doc',
};

// 请求超时时间（毫秒）
// Agent 使用 Function Calling + ReAct 循环，需要较长时间
export const REQUEST_TIMEOUT = 1200000;

// 轮询间隔（毫秒）
export const POLL_INTERVAL = 1000;
