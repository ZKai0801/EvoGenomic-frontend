import { useState, useCallback, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Sidebar, ChatArea, ProjectView, AuthGuard, useAuth, WorkspacePanel } from '@/components';
import SkillLibrary from '@/components/SkillLibrary';
import LoginPromptModal from '@/components/LoginPromptModal';
import { LoginPage } from '@/components/LoginPage';
import { RegisterPage } from '@/components/RegisterPage';
import { ForgotPasswordPage } from '@/components/ForgotPasswordPage';
import { UpgradePage } from '@/components/UpgradePage';
import { PaymentPage } from '@/components/PaymentPage';
import { Message, ModuleType, ChatSession, Project, QuestionData, PlanData, ReferencedFile, StepOutput, ToolCallInfo, normalizePlanData } from '@/types';
import { generateId } from '@/data/mockData';
import { agentApiClient, chatApiClient, authApiClient, AgentType, ChatSessionResponse, ChatMessageResponse, ProjectResponse } from '@/api';

// 模块到 Agent 类型的映射
const moduleToAgentType: Record<ModuleType, AgentType> = {
  'chat': 'model',
  'statistics': 'model',  // 统计模块也使用 model agent
};

// 将 API 响应转换为前端 ChatSession 格式
const convertApiSession = (session: ChatSessionResponse, messages: Message[] = []): ChatSession => ({
  id: String(session.id),
  chatId: session.chat_id ?? undefined,
  title: session.title || '新对话',
  messages,
  createdAt: new Date(session.created_at),
  updatedAt: new Date(session.updated_at),
  moduleType: 'chat' as ModuleType,
  projectId: session.project_id ? String(session.project_id) : undefined,
});

// 将 API 消息响应转换为前端 Message 格式
const convertApiMessage = (msg: ChatMessageResponse): Message => ({
  id: String(msg.id),
  role: msg.role as 'user' | 'assistant',
  content: msg.content,
  timestamp: new Date(msg.created_at),
});

// 将后端 ProjectResponse 转换为前端 Project 类型
const convertApiProject = (p: ProjectResponse): Project => ({
  id: String(p.id),
  name: p.name,
  description: p.description ?? undefined,
  autoExecute: p.auto_execute ?? false,
  chats: [],
  createdAt: new Date(p.created_at),
  updatedAt: new Date(p.updated_at),
});

function MainApp() {
  const { isGuest, user } = useAuth();
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [currentModule, setCurrentModule] = useState<ModuleType>('chat');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentChatId, setCurrentChatId] = useState<string | undefined>(undefined);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [chatHistory, setChatHistory] = useState<ChatSession[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | undefined>(undefined);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isWorkspacePanelOpen, setIsWorkspacePanelOpen] = useState(false);
  const [showSkillLibrary, setShowSkillLibrary] = useState(false);
  const [workspaceActiveTab, setWorkspaceActiveTab] = useState<'files' | 'plan' | 'env'>('files');
  const [planData, setPlanData] = useState<PlanData | null>(null);
  const [isPlanEditable, setIsPlanEditable] = useState(false);
  const [isPlanExecuting, setIsPlanExecuting] = useState(false);
  const [referencedFiles, setReferencedFiles] = useState<ReferencedFile[]>([]);
  const [stepOutputs, setStepOutputs] = useState<Map<number, StepOutput>>(new Map());
  const [toolCalls, setToolCalls] = useState<Map<number, ToolCallInfo[]>>(new Map());
  
  // 用于追踪数据库会话 ID（数字类型）
  const dbSessionIdRef = useRef<number | null>(null);
  // 记录上一次的 currentModule，用于判断模块是否变化
  const prevModuleRef = useRef<ModuleType>(currentModule);
  // 取消流式响应的函数引用
  const cancelStreamRef = useRef<(() => void) | null>(null);
  // 标记模块切换是否来自 handleSelectChat（选中聊天时不重置会话）
  const moduleChangedBySelectChatRef = useRef(false);
  // 标记是否已尝试恢复上次活跃的聊天（防止重复恢复）
  const chatRestoredRef = useRef(false);

  // 从数据库加载聊天历史
  const loadChatHistoryFromApi = useCallback(async () => {
    if (!authApiClient.isAuthenticated()) {
      setIsLoadingHistory(false);
      return;
    }
    
    try {
      setIsLoadingHistory(true);
      const sessionsData = await chatApiClient.getSessions(100, 0, true);
      const sessions: ChatSession[] = sessionsData.map(s => convertApiSession(s));
      setChatHistory(sessions);
    } catch (error) {
      console.error('加载聊天历史失败:', error);
      // 如果 API 失败，回退到空列表
      setChatHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  // 从后端加载项目列表
  const loadProjectsFromApi = useCallback(async () => {
    if (!authApiClient.isAuthenticated()) return;
    try {
      const projectsData = await chatApiClient.getProjects();
      setProjects(projectsData.map(convertApiProject));
    } catch (error) {
      console.error('加载项目列表失败:', error);
    }
  }, []);

  // 初始化时加载聊天历史和项目
  useEffect(() => {
    loadChatHistoryFromApi();
    loadProjectsFromApi();
  }, [loadChatHistoryFromApi, loadProjectsFromApi]);

  // 持久化当前活跃聊天 ID 到 sessionStorage（页面刷新后可自动恢复）
  useEffect(() => {
    if (currentChatId) {
      sessionStorage.setItem('activeChatId', currentChatId);
    } else {
      sessionStorage.removeItem('activeChatId');
    }
  }, [currentChatId]);

  useEffect(() => {
    if (sessionId) {
      sessionStorage.setItem('activeSessionId', sessionId);
    }
  }, [sessionId]);

  // 当模块切换时，重置会话（但如果是从 handleSelectChat 触发的则跳过）
  useEffect(() => {
    // 模块没有实际变化时跳过（StrictMode 二次执行也安全）
    if (prevModuleRef.current === currentModule) {
      return;
    }
    prevModuleRef.current = currentModule;

    // 由 handleSelectChat 发起的模块切换，不重置会话
    if (moduleChangedBySelectChatRef.current) {
      moduleChangedBySelectChatRef.current = false;
      return;
    }
    // 手动切换模块时重置以获得干净的上下文
    setSessionId(undefined);
    setMessages([]);
    setCurrentChatId(undefined);
  }, [currentModule]);

  const handleModuleChange = useCallback((module: ModuleType) => {
    setCurrentModule(module);
  }, []);

  // 引用文件管理
  const handleAddReferencedFile = useCallback((file: ReferencedFile) => {
    setReferencedFiles(prev => {
      // 去重：相同工作区路径不重复添加
      if (prev.some(f => f.workspacePath === file.workspacePath)) return prev;
      return [...prev, file];
    });
  }, []);

  const handleRemoveReferencedFile = useCallback((workspacePath: string) => {
    setReferencedFiles(prev => prev.filter(f => f.workspacePath !== workspacePath));
  }, []);

  const handleClearReferencedFiles = useCallback(() => {
    setReferencedFiles([]);
  }, []);

  // 从工作区面板选择文件
  const handleWorkspaceFileSelect = useCallback((path: string, name: string) => {
    handleAddReferencedFile({ name, workspacePath: path, source: 'workspace' });
  }, [handleAddReferencedFile]);

  // 更新本地聊天历史状态
  const updateLocalChatHistory = useCallback((chatId: string, msgs: Message[], projectId?: string, chatTitle?: string) => {
    setChatHistory(prev => {
      const existingIndex = prev.findIndex(c => c.id === chatId);
      // 优先使用 Think 生成的 title，其次使用现有 title，最后截取首条消息
      const title = chatTitle
        || (existingIndex >= 0 ? prev[existingIndex].title : undefined)
        || (msgs.length > 0 
          ? msgs[0].content.slice(0, 30) + (msgs[0].content.length > 30 ? '...' : '')
          : '新对话');
      
      const updatedChat: ChatSession = {
        id: chatId,
        title,
        messages: msgs,
        createdAt: existingIndex >= 0 ? prev[existingIndex].createdAt : new Date(),
        updatedAt: new Date(),
        moduleType: currentModule,
        projectId,
      };

      if (existingIndex >= 0) {
        const newHistory = [...prev];
        newHistory[existingIndex] = updatedChat;
        return newHistory;
      } else {
        return [updatedChat, ...prev];
      }
    });
  }, [currentModule]);

  const handleNewChat = useCallback(() => {
    // 重置当前会话状态
    setMessages([]);
    setCurrentChatId(undefined);
    setSessionId(undefined);
    dbSessionIdRef.current = null;
    setIsLoading(false);
    setStepOutputs(new Map());
    setToolCalls(new Map());
    setReferencedFiles([]);
    setPlanData(null);
    setIsPlanEditable(false);
    setIsPlanExecuting(false);
    setShowSkillLibrary(false);
    // 清除 sessionStorage 中的活跃聊天记录
    sessionStorage.removeItem('activeChatId');
    sessionStorage.removeItem('activeSessionId');
  }, []);

  const handleSelectChat = useCallback(async (chat: ChatSession) => {
    setCurrentChatId(chat.id);
    setShowSkillLibrary(false);
    // 使用 chat_id (UUID) 恢复 agent 会话（LangGraph thread_id = chat_id）
    setSessionId(chat.chatId || undefined);
    dbSessionIdRef.current = parseInt(chat.id, 10) || null;
    setIsLoading(false);
    setStepOutputs(new Map());
    setToolCalls(new Map());
    setReferencedFiles([]);
    
    // 从数据库加载完整消息
    if (authApiClient.isAuthenticated() && dbSessionIdRef.current) {
      try {
        const messagesData = await chatApiClient.getMessages(dbSessionIdRef.current, 100, 0);
        const loadedMessages = messagesData.map(convertApiMessage);
        setMessages(loadedMessages);
      } catch (error) {
        console.warn('加载会话消息失败:', error);
        // 回退到本地缓存的消息
        setMessages(chat.messages || []);
      }
    } else {
      setMessages(chat.messages || []);
    }
    
    // 恢复执行计划（携带 agent session_id 以获取后台执行状态）
    const agentSid = chat.chatId || undefined;  // chat_id UUID = agent session_id
    if (authApiClient.isAuthenticated() && dbSessionIdRef.current) {
      try {
        const { plan, execution_status } = await chatApiClient.getLatestPlan(dbSessionIdRef.current, agentSid);
        const normalized = normalizePlanData(plan);
        if (normalized) {
          setPlanData(normalized);
          setIsPlanEditable(false);

          if (execution_status === 'running' && agentSid) {
            // 后台仍在执行 → 重连 SSE 继续接收实时事件
            setIsPlanExecuting(true);
            setIsWorkspacePanelOpen(true);
            setWorkspaceActiveTab('plan');
            // 通过发送空消息 + 已有 session_id 触发 SSE 重连（后端检测到 running 状态只订阅不启动）
            agentApiClient.chatStream(
              '',          // 重连用空消息
              agentSid,
              'model' as AgentType,
              (chunk) => {
                // 接收后续增量内容
                setMessages(prev => {
                  const lastIdx = prev.length - 1;
                  if (lastIdx < 0 || prev[lastIdx].role !== 'assistant') return prev;
                  return prev.map((m, i) =>
                    i === lastIdx ? { ...m, content: m.content + chunk } : m
                  );
                });
              },
              (_response, _sid, title, planResult) => {
                setIsPlanExecuting(false);
                if (planResult) setPlanData(normalizePlanData(planResult) || planResult as PlanData);
                if (title) {
                  setChatHistory(prev =>
                    prev.map(c => c.id === chat.id ? { ...c, title } : c)
                  );
                }
              },
              (error) => {
                console.error('重连 SSE 出错:', error);
                setIsPlanExecuting(false);
              },
              (qData) => {
                if (qData.plan) {
                  setPlanData(normalizePlanData(qData.plan) || qData.plan as PlanData);
                  setIsPlanEditable(true);
                  setIsWorkspacePanelOpen(true);
                  setWorkspaceActiveTab('plan');
                }
                setIsPlanExecuting(false);
              },
              (statusData) => {
                // 转发 step_update / step_chunk / 其他状态事件到现有处理逻辑
                if (statusData.type === 'step_update' && statusData.step_id != null) {
                  setPlanData(prev => {
                    if (!prev || !prev.steps) return prev;
                    return {
                      ...prev,
                      steps: prev.steps.map((s: any) =>
                        s.step_id === statusData.step_id
                          ? { ...s, status: statusData.status || s.status }
                          : s
                      ),
                    };
                  });
                }
              },
              undefined,   // onSession — 不需要
              undefined,   // projectId — 已有
            );
          } else if (execution_status === 'waiting_for_input' && agentSid) {
            // 等待用户输入 → 从 pending_question 恢复 QuestionCard
            setIsPlanExecuting(false);
            try {
              const statusResp = await agentApiClient.getSessionStatus(agentSid);
              if (statusResp.pending_question) {
                const qd = statusResp.pending_question;
                if (qd.plan) {
                  setPlanData(normalizePlanData(qd.plan) || qd.plan as PlanData);
                  setIsPlanEditable(true);
                  setIsWorkspacePanelOpen(true);
                  setWorkspaceActiveTab('plan');
                }
              }
            } catch {
              // status 查询失败不影响正常使用
            }
          } else {
            // 已完成/出错/无活跃执行 → 静态展示（后端已清理 stale running）
            setIsPlanExecuting(false);
          }
        } else {
          setPlanData(null);
        }
      } catch (err) {
        console.warn('加载执行计划失败:', err);
        setPlanData(null);
      }
    } else {
      setPlanData(null);
    }

    // 恢复各节点输出摘要（按 msg_id 分组附加到对应的 assistant 消息）
    if (authApiClient.isAuthenticated() && dbSessionIdRef.current) {
      try {
        const resp = await chatApiClient.getNodeOutputs(dbSessionIdRef.current);
        const byMsg = resp.node_outputs_by_msg;
        const flatOutputs = resp.node_outputs;
        if (byMsg && Object.keys(byMsg).length > 0) {
          setMessages(prev => {
            // 建立 msg_id → 下一条 assistant 消息 index 的映射
            const msgIdToNextAssistant = new Map<string, number>();
            for (let i = 0; i < prev.length; i++) {
              if (prev[i].role === 'user' && prev[i].id) {
                // 找到此 user msg 之后的第一条 assistant msg
                for (let j = i + 1; j < prev.length; j++) {
                  if (prev[j].role === 'assistant') {
                    msgIdToNextAssistant.set(prev[i].id!, j);
                    break;
                  }
                }
              }
            }
            // 按 assistant 消息 index 收集 node outputs
            const indexToOutputs = new Map<number, Array<{ node: string; content: string }>>();
            for (const [msgId, outputs] of Object.entries(byMsg)) {
              const idx = msgIdToNextAssistant.get(msgId);
              if (idx !== undefined) {
                indexToOutputs.set(idx, [...(indexToOutputs.get(idx) || []), ...outputs]);
              }
            }
            // 兜底：如果没有任何 msg_id 匹配上，使用 flat 列表附加到最后一条 assistant
            if (indexToOutputs.size === 0 && flatOutputs && flatOutputs.length > 0) {
              const lastIdx = [...prev].reverse().findIndex(m => m.role === 'assistant');
              if (lastIdx !== -1) {
                indexToOutputs.set(prev.length - 1 - lastIdx, flatOutputs);
              }
            }
            if (indexToOutputs.size === 0) return prev;
            return prev.map((m, i) => {
              const outputs = indexToOutputs.get(i);
              return outputs ? { ...m, nodeOutputs: outputs } : m;
            });
          });
        } else if (flatOutputs && flatOutputs.length > 0) {
          // 兼容旧格式：附加到最后一条 assistant 消息
          setMessages(prev => {
            const lastAssistantIdx = [...prev].reverse().findIndex(m => m.role === 'assistant');
            if (lastAssistantIdx === -1) return prev;
            const realIdx = prev.length - 1 - lastAssistantIdx;
            return prev.map((m, i) =>
              i === realIdx ? { ...m, nodeOutputs: flatOutputs } : m
            );
          });
        }
      } catch {
        // node outputs 加载失败不影响正常使用
      }
    }

    // 恢复 Executor 工具调用历史（按 step_id 分组）
    if (authApiClient.isAuthenticated() && dbSessionIdRef.current) {
      try {
        const { tool_logs } = await chatApiClient.getToolLogs(dbSessionIdRef.current);
        if (tool_logs && Object.keys(tool_logs).length > 0) {
          const toolCallMap = new Map<number, ToolCallInfo[]>();
          for (const [stepId, calls] of Object.entries(tool_logs)) {
            const mapped: ToolCallInfo[] = calls.map((tc: any) => ({
              id: tc.id,
              tool: tc.tool,
              arguments: tc.arguments || {},
              status: tc.success ? 'complete' as const : 'error' as const,
              output: tc.output,
              error: tc.error,
              duration_ms: tc.duration_ms,
            }));
            toolCallMap.set(Number(stepId), mapped);
          }
          setToolCalls(toolCallMap);
        }
      } catch {
        // tool logs 加载失败不影响正常使用
      }
    }

    // 如果会话有关联的模块类型，切换到该模块（标记跳过重置）
    if (chat.moduleType && chat.moduleType !== currentModule) {
      moduleChangedBySelectChatRef.current = true;
      setCurrentModule(chat.moduleType);
    }
  }, [currentModule]);

  // 页面刷新后自动恢复上次活跃的聊天
  useEffect(() => {
    if (chatRestoredRef.current || isLoadingHistory || currentChatId) return;
    chatRestoredRef.current = true;

    const savedChatId = sessionStorage.getItem('activeChatId');
    if (savedChatId && chatHistory.length > 0) {
      const chat = chatHistory.find(c => c.id === savedChatId);
      if (chat) {
        // 恢复 sessionId（agent SSE 会话标识）
        const savedSessionId = sessionStorage.getItem('activeSessionId');
        if (savedSessionId) {
          setSessionId(savedSessionId);
        }
        handleSelectChat(chat);
      }
    }
  }, [isLoadingHistory, chatHistory, currentChatId, handleSelectChat]);

  // 删除聊天记录
  const handleDeleteChat = useCallback(async (chatId: string) => {
    const dbId = parseInt(chatId, 10);

    if (authApiClient.isAuthenticated() && dbId) {
      try {
        // 先检查是否有关联文件
        const fileInfo = await chatApiClient.checkConversationFiles(dbId);
        let deleteFiles = false;

        if (fileInfo.has_files) {
          const confirmed = window.confirm(
            `该会话下存在 ${fileInfo.file_count} 个文件，删除会话将同时删除这些文件。\n\n确定要删除吗？`
          );
          if (!confirmed) return;
          deleteFiles = true;
        }

        await chatApiClient.deleteSession(dbId, deleteFiles);
      } catch (error) {
        console.error('删除会话失败:', error);
      }
    }
    
    // 从本地状态删除
    setChatHistory(prev => prev.filter(c => c.id !== chatId));
    if (currentChatId === chatId) {
      handleNewChat();
    }
  }, [currentChatId, handleNewChat]);

  // 选择项目 - 显示项目视图
  const handleSelectProject = useCallback((project: Project) => {
    setCurrentProjectId(project.id);
    // 清空当前聊天，进入项目视图
    setMessages([]);
    setCurrentChatId(undefined);
    setSessionId(undefined);
    setReferencedFiles([]);
  }, []);

  // 退出项目视图
  const handleExitProjectView = useCallback(() => {
    setCurrentProjectId(undefined);
  }, []);

  // 创建新项目（通过后端 API）
  const handleCreateProject = useCallback(async (name: string, description?: string): Promise<string> => {
    if (!authApiClient.isAuthenticated()) {
      // 未登录时回退到本地创建
      const newProject: Project = {
        id: generateId(),
        name,
        description,
        chats: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setProjects(prev => [newProject, ...prev]);
      setCurrentProjectId(newProject.id);
      return newProject.id;
    }
    
    try {
      const resp = await chatApiClient.createProject({ name, description });
      const newProject = convertApiProject(resp);
      setProjects(prev => [newProject, ...prev]);
      setCurrentProjectId(newProject.id);
      return newProject.id;
    } catch (error) {
      console.error('创建项目失败:', error);
      return '';
    }
  }, []);

  // 删除项目（通过后端 API，后端会级联软删除项目下的对话）
  const handleDeleteProject = useCallback(async (projectId: string) => {
    // 从后端删除
    const dbId = parseInt(projectId, 10);
    if (authApiClient.isAuthenticated() && dbId) {
      try {
        await chatApiClient.deleteProject(dbId);
      } catch (error) {
        console.error('删除项目失败:', error);
      }
    }
    
    // 更新本地状态：移除项目及其下的所有对话（后端会级联软删除）
    setProjects(prev => prev.filter(p => p.id !== projectId));
    setChatHistory(prev => prev.filter(c => c.projectId !== projectId));
    if (currentProjectId === projectId) {
      setCurrentProjectId(undefined);
    }
  }, [currentProjectId]);

  // 更新项目 auto_execute 设置
  const handleUpdateAutoExecute = useCallback(async (autoExecute: boolean) => {
    if (!currentProjectId) return;
    const dbId = parseInt(currentProjectId, 10);
    if (!authApiClient.isAuthenticated() || !dbId) return;
    try {
      await chatApiClient.updateProject(dbId, { auto_execute: autoExecute });
      setProjects(prev =>
        prev.map(p =>
          p.id === currentProjectId ? { ...p, autoExecute } : p
        )
      );
    } catch (error) {
      console.error('更新无限模式失败:', error);
    }
  }, [currentProjectId]);

  // 重命名项目（通过后端 API）
  const handleRenameProject = useCallback(async (projectId: string, newName: string) => {
    const dbId = parseInt(projectId, 10);
    if (authApiClient.isAuthenticated() && dbId) {
      try {
        await chatApiClient.updateProject(dbId, { name: newName });
      } catch (error) {
        console.error('重命名项目失败:', error);
      }
    }
    setProjects(prev => prev.map(p =>
      p.id === projectId ? { ...p, name: newName, updatedAt: new Date() } : p
    ));
  }, []);

  // 合并项目（将一个项目的所有聊天移动到另一个项目）
  const handleMergeProject = useCallback(async (sourceProjectId: string, targetProjectId: string) => {
    // 获取源项目的所有对话并逐个迁移到目标项目
    const targetDbId = parseInt(targetProjectId, 10);
    if (authApiClient.isAuthenticated() && targetDbId) {
      const chatsToMove = chatHistory.filter(c => c.projectId === sourceProjectId);
      for (const chat of chatsToMove) {
        const chatDbId = parseInt(chat.id, 10);
        if (chatDbId) {
          try {
            await chatApiClient.updateSession(chatDbId, { project_id: targetDbId });
          } catch (error) {
            console.error(`移动对话 ${chat.id} 失败:`, error);
          }
        }
      }
    }
    
    // 更新本地状态
    setChatHistory(prev => prev.map(c =>
      c.projectId === sourceProjectId ? { ...c, projectId: targetProjectId, updatedAt: new Date() } : c
    ));
    setProjects(prev => prev.map(p =>
      p.id === targetProjectId ? { ...p, updatedAt: new Date() } : p
    ));
  }, [chatHistory]);

  // 将对话移动到项目
  const handleMoveToProject = useCallback(async (chatId: string, projectId: string | undefined) => {
    // 更新本地状态
    setChatHistory(prev => prev.map(c =>
      c.id === chatId ? { ...c, projectId, updatedAt: new Date() } : c
    ));
    if (projectId) {
      setProjects(prev => prev.map(p =>
        p.id === projectId ? { ...p, updatedAt: new Date() } : p
      ));
    }
    // 持久化到数据库
    const dbId = parseInt(chatId, 10);
    if (authApiClient.isAuthenticated() && dbId) {
      try {
        await chatApiClient.updateSession(dbId, {
          project_id: projectId ? parseInt(projectId, 10) : null,
        });
      } catch (error) {
        console.error('移动对话到项目失败:', error);
      }
    }
  }, []);

  // 重命名聊天
  const handleRenameChat = useCallback(async (chatId: string, newTitle: string) => {
    // 更新数据库
    const dbId = parseInt(chatId, 10);
    if (authApiClient.isAuthenticated() && dbId) {
      try {
        await chatApiClient.updateSession(dbId, { title: newTitle });
      } catch (error) {
        console.error('重命名会话失败:', error);
      }
    }
    
    // 更新本地状态
    setChatHistory(prev => prev.map(c =>
      c.id === chatId ? { ...c, title: newTitle, updatedAt: new Date() } : c
    ));
  }, []);

  const handleSendMessage = useCallback(async (content: string) => {
    if (isGuest) {
      setShowLoginPrompt(true);
      return;
    }
    // 添加用户消息
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);
    setStepOutputs(new Map());
    setToolCalls(new Map());

    // 添加流式占位消息
    const streamingMessageId = generateId();
    const streamingMessage: Message = {
      id: streamingMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isAgentWorking: true,
    };
    setMessages(prev => [...prev, streamingMessage]);

    // 已有会话不修改标题（title 仅由 Think 首次生成或用户手动重命名设置）
    // 新会话不在这里创建 DB 记录，由后端 chat_stream 统一创建，避免双重写入

    try {
      // 使用流式 API
      const agentType = moduleToAgentType[currentModule];
      let fullResponse = '';
      let finalSessionId = sessionId;
      
      // 启动流式响应
      const cancelStream: () => void = agentApiClient.chatStream(
        content,
        sessionId,
        agentType,
        // onChunk: 接收增量内容
        (chunk: string) => {
          fullResponse += chunk;
          setMessages(prev => 
            prev.map(m => 
              m.id === streamingMessageId 
                ? { ...m, content: fullResponse, isAgentWorking: true }
                : m
            )
          );
        },
        // onComplete: 完成时的回调
        async (response: string, newSessionId: string, title?: string, plan?: any) => {
          cancelStreamRef.current = null;
          fullResponse = response;

          // 更新 plan 状态（执行完成后的最终状态）
          if (plan) {
            setPlanData(normalizePlanData(plan) || plan as PlanData);
            setIsPlanEditable(false);
            setIsWorkspacePanelOpen(true);
            setWorkspaceActiveTab('plan');
          }
          setIsPlanExecuting(false);
          
          // 统一计算 chatId：优先使用 DB 主键（由后端预创建）
          const chatId = dbSessionIdRef.current
            ? String(dbSessionIdRef.current)
            : currentChatId || newSessionId || generateId();
          
          // 保存会话 ID
          if (!sessionId) {
            setSessionId(newSessionId);
            finalSessionId = newSessionId;
          }
          if (!currentChatId) {
            setCurrentChatId(chatId);
          }
          
          // 更新最终消息（保留流式阶段累积的 nodeOutputs）
          
          // 消息由 BioAgent 内部持久化（save_message），前端不再重复写入
          
          // 更新消息并同步聊天历史
          setMessages(prev => {
            const streamingMsg = prev.find(m => m.id === streamingMessageId);
            const finalMessage: Message = {
              id: streamingMessageId,
              role: 'assistant',
              content: fullResponse,
              timestamp: new Date(),
              isAgentWorking: false,
              nodeOutputs: streamingMsg?.nodeOutputs,
            };
            const newMessages = prev.map(m => 
              m.id === streamingMessageId ? finalMessage : m
            );
            // 在下一帧更新聊天历史，确保 newMessages 已计算完成
            queueMicrotask(() => updateLocalChatHistory(chatId, newMessages, currentProjectId, title));
            return newMessages;
          });
          
          setIsLoading(false);
        },
        // onError: 错误回调 — 保留已累积的中间内容，追加错误信息
        (error: string) => {
          cancelStreamRef.current = null;
          console.error('流式响应错误:', error);
          setIsPlanExecuting(false);
          
          setMessages(prev => 
            prev.map(m => {
              if (m.id !== streamingMessageId) return m;
              // 保留流式阶段已累积的内容和 nodeOutputs，追加错误提示
              const existingContent = m.content || '';
              const errorSuffix = `\n\n---\n**执行出错**：${error}`;
              return {
                ...m,
                content: existingContent ? existingContent + errorSuffix : `抱歉，处理您的请求时出错：${error}`,
                isAgentWorking: false,
              };
            })
          );
          
          setIsLoading(false);
        },
        // onQuestion: Human-in-the-Loop 提问回调
        (questionData: { text: string; options: string[]; allow_freeform?: boolean; context?: string; plan?: any }) => {
          // 检测是否携带 plan 数据
          if (questionData.plan) {
            setPlanData(normalizePlanData(questionData.plan) || questionData.plan as PlanData);
            setIsPlanEditable(true);
            setIsWorkspacePanelOpen(true);
            setWorkspaceActiveTab('plan');
          }

          // 将占位消息更新为带提问数据的消息（保留已累积的 nodeOutputs）
          setMessages(prev =>
            prev.map(m => {
              if (m.id !== streamingMessageId) return m;
              return {
                ...m,
                content: questionData.plan
                  ? '请在右侧规划面板确认执行计划'
                  : questionData.text,
                isAgentWorking: false,
                questionData: questionData.plan
                  ? undefined
                  : (questionData as QuestionData),
              };
            })
          );
          
          // 更新 session ID
          if (!sessionId && finalSessionId) {
            setSessionId(finalSessionId);
          }
          
          setIsLoading(false);
        },
        // onStatus: 节点状态更新回调
        (data: { node?: string; step_id?: number; status?: string; type: string; title?: string }) => {
          const nodeLabels: Record<string, string> = {
            think: '正在思考...',
            planner: '正在规划...',
            executor: '正在执行...',
            reviewer: '正在审查...',
            answer: '正在回答...',
          };

          if (data.type === 'status' && data.node) {
            const label = nodeLabels[data.node] || `正在处理 (${data.node})...`;
            setMessages(prev =>
              prev.map(m =>
                m.id === streamingMessageId
                  ? { ...m, thinkingStatus: label }
                  : m
              )
            );
            // Executor 开始时标记为执行中
            if (data.node === 'executor') {
              setIsPlanExecuting(true);
            }
            // Think 节点完成时立即更新侧边栏标题（无需等 final 事件）
            if (data.node === 'think' && data.title) {
              const chatId = dbSessionIdRef.current
                ? String(dbSessionIdRef.current)
                : currentChatId || '';
              const newTitle = data.title;
              if (chatId) {
                setChatHistory(prev => {
                  const exists = prev.some(c => c.id === chatId);
                  if (exists) {
                    return prev.map(c => c.id === chatId ? { ...c, title: newTitle } : c);
                  }
                  // 对话条目尚不存在（新会话），立即创建以在侧边栏显示
                  const newChat: ChatSession = {
                    id: chatId,
                    title: newTitle,
                    messages: [],
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    moduleType: currentModule,
                    projectId: currentProjectId,
                  };
                  return [newChat, ...prev];
                });
              }
            }
          } else if (data.type === 'plan_update' && (data as any).plan) {
            // Planner 完成时立即设置 plan 数据并打开规划面板
            setPlanData(normalizePlanData((data as any).plan) || (data as any).plan as PlanData);
            setIsPlanEditable(false);
            setIsWorkspacePanelOpen(true);
            setWorkspaceActiveTab('plan');
          } else if (data.type === 'step_update' && data.step_id != null) {
            // 更新 PlanPanel 中的步骤状态和输出
            setPlanData(prev => {
              if (!prev) return prev;
              return {
                ...prev,
                steps: prev.steps.map(s => {
                  if (s.step_id !== data.step_id || !data.status) return s;
                  const updated: any = { ...s, status: data.status };
                  if ((data as any).output != null) updated.output = (data as any).output;
                  return updated;
                }),
              };
            });
            // 更新 stepOutputs 状态
            const stepId = data.step_id as number;
            const stepStatus = data.status as 'running' | 'complete' | 'error';
            setStepOutputs(prev => {
              const next = new Map(prev);
              const existing = next.get(stepId);
              if (stepStatus === 'running') {
                // 步骤开始，创建空 entry
                next.set(stepId, { step_id: stepId, content: '', status: 'running' });
              } else if (existing) {
                // 步骤完成/错误，更新状态（若有 output 则覆盖 content）
                next.set(stepId, {
                  ...existing,
                  status: stepStatus,
                  content: (data as any).output ?? existing.content,
                });
              }
              return next;
            });
          } else if (data.type === 'step_chunk' && (data as any).step_id != null) {
            // 实时累积步骤 LLM 输出
            const stepId = (data as any).step_id as number;
            const token = (data as any).content as string;
            setStepOutputs(prev => {
              const next = new Map(prev);
              const existing = next.get(stepId);
              if (existing) {
                next.set(stepId, { ...existing, content: existing.content + token });
              } else {
                next.set(stepId, { step_id: stepId, content: token, status: 'running' });
              }
              return next;
            });
          } else if (data.type === 'tool_call' && (data as any).step_id != null) {
            // Executor 工具调用实时事件
            const stepId = (data as any).step_id as number;
            const event = (data as any).event as 'start' | 'end';
            const toolName = (data as any).tool as string;
            setToolCalls(prev => {
              const next = new Map(prev);
              const list = [...(next.get(stepId) ?? [])];
              if (event === 'start') {
                list.push({
                  id: `${stepId}-${list.length}`,
                  tool: toolName,
                  arguments: (data as any).arguments ?? {},
                  status: 'running',
                  isDocker: toolName === 'run_docker_tool',
                });
              } else if (event === 'end') {
                // 更新最后一个同名工具的 running 记录
                for (let i = list.length - 1; i >= 0; i--) {
                  if (list[i].tool === toolName && list[i].status === 'running') {
                    list[i] = {
                      ...list[i],
                      status: (data as any).success ? 'complete' : 'error',
                      output: (data as any).output,
                      error: (data as any).error,
                      duration_ms: (data as any).duration_ms,
                    };
                    break;
                  }
                }
              }
              next.set(stepId, list);
              return next;
            });
          } else if (data.type === 'observe' && (data as any).step_id != null) {
            // Observe 评估结果：附加到该步骤最近一次已完成的工具调用上
            const stepId = (data as any).step_id as number;
            const decision = (data as any).decision as 'continue' | 'retry' | 'fail';
            const reason = (data as any).reason as string;
            setToolCalls(prev => {
              const next = new Map(prev);
              const list = [...(next.get(stepId) ?? [])];
              // 找到最近一个已完成（非 running）的工具调用，附加 observe 结果
              for (let i = list.length - 1; i >= 0; i--) {
                if (list[i].status !== 'running' && !list[i].observeDecision) {
                  list[i] = { ...list[i], observeDecision: decision, observeReason: reason };
                  break;
                }
              }
              next.set(stepId, list);
              return next;
            });
          } else if (data.type === 'node_output' && (data as any).node && (data as any).content) {
            // 累积各节点的内容摘要到当前流式消息
            const nodeInfo = { node: (data as any).node as string, content: (data as any).content as string };
            setMessages(prev =>
              prev.map(m => {
                if (m.id !== streamingMessageId) return m;
                const existing = m.nodeOutputs || [];
                return { ...m, nodeOutputs: [...existing, nodeInfo] };
              })
            );
          }
        },
        // onSession: 后端返回会话信息（含 DB 主键）
        (data: { session_id: string; db_chat_id?: number }) => {
          // 立即保存 session_id，确保后续 interrupt resume 能复用同一会话
          if (data.session_id) {
            finalSessionId = data.session_id;
            if (!sessionId) {
              setSessionId(data.session_id);
            }
          }
          if (data.db_chat_id != null) {
            dbSessionIdRef.current = data.db_chat_id;
            // 立即在侧边栏创建"未命名"占位条目（Think 返回 title 后会覆盖）
            const chatId = String(data.db_chat_id);
            if (!currentChatId) {
              setCurrentChatId(chatId);
            }
            setChatHistory(prev => {
              if (prev.some(c => c.id === chatId)) return prev;
              const placeholder: ChatSession = {
                id: chatId,
                chatId: data.session_id,
                title: '未命名',
                messages: [],
                createdAt: new Date(),
                updatedAt: new Date(),
                moduleType: currentModule,
                projectId: currentProjectId,
              };
              return [placeholder, ...prev];
            });
          }
        },
        // projectId: 当前项目 ID（传给后端用于 auto_execute 查询）
        currentProjectId ? Number(currentProjectId) : undefined,
      );
      cancelStreamRef.current = cancelStream;

    } catch (error) {
      // chatStream() 是同步返回（流在后台进行），仅在同步阶段出错才到这里
      // loading 状态由 onComplete/onError/onQuestion 回调管理，此处只处理启动失败的情况
      console.error('Chat stream setup error:', error);
      
      // 错误处理：替换流式消息为错误消息
      const errorMessage: Message = {
        id: generateId(),
        role: 'assistant',
        content: `抱歉，处理您的请求时出现错误：${error instanceof Error ? error.message : '未知错误'}\n\n请稍后重试。`,
        timestamp: new Date(),
      };

      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== streamingMessageId);
        return [...filtered, errorMessage];
      });

      setIsLoading(false);
    }
  }, [isGuest, currentModule, sessionId, currentChatId, currentProjectId, updateLocalChatHistory]);

  // Plan 确认回调
  const handlePlanConfirm = useCallback((plan: PlanData) => {
    setIsPlanEditable(false);
    // 将修改后的 plan 作为 JSON 字符串发送回后端
    handleSendMessage(JSON.stringify(plan));
  }, [handleSendMessage]);

  // Plan 退出回调
  const handlePlanExit = useCallback(() => {
    setIsPlanEditable(false);
    setPlanData(null);
    handleSendMessage('退出');
  }, [handleSendMessage]);

  // 停止 LLM 流式输出（聊天中点击停止按钮）
  const handleStopGeneration = useCallback(() => {
    // 1. 关闭 SSE 连接
    if (cancelStreamRef.current) {
      cancelStreamRef.current();
      cancelStreamRef.current = null;
    }
    // 2. 通知后端设置取消信号
    if (sessionId) {
      agentApiClient.cancelSession(sessionId).catch(console.error);
    }
    // 3. 更新 UI 状态
    setIsLoading(false);
    setIsPlanExecuting(false);
    setMessages(prev =>
      prev.map(m => m.isAgentWorking
        ? { ...m, isAgentWorking: false, thinkingStatus: undefined }
        : m
      )
    );
    // 将运行中/待执行步骤标记为 cancelled（与 handleCancelExecution 保持一致）
    setPlanData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        steps: prev.steps.map(s =>
          s.status === 'running' || s.status === 'pending'
            ? { ...s, status: 'cancelled' as any }
            : s
        ),
      };
    });
  }, [sessionId]);

  // 中断 Executor 执行（右侧规划面板中的中断按钮）
  const handleCancelExecution = useCallback(() => {
    // 1. 关闭 SSE 连接
    if (cancelStreamRef.current) {
      cancelStreamRef.current();
      cancelStreamRef.current = null;
    }
    // 2. 通知后端设置取消信号
    if (sessionId) {
      agentApiClient.cancelSession(sessionId).catch(console.error);
    }
    // 3. 更新 UI 状态
    setIsPlanExecuting(false);
    setIsLoading(false);
    // 将正在运行的步骤标记为 cancelled
    setPlanData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        steps: prev.steps.map(s =>
          s.status === 'running' || s.status === 'pending'
            ? { ...s, status: 'cancelled' as any }
            : s
        ),
      };
    });
  }, [sessionId]);

  // Plan 手动执行回调（通过 /api/agent/chat/execute 端点）
  const handleExecutePlan = useCallback((stepIds?: number[]) => {
    if (!sessionId) return;

    setIsPlanExecuting(true);
    setStepOutputs(new Map());
    setToolCalls(new Map());

    // 立即将目标步骤重置为 pending，避免界面滞后
    setPlanData(prev => {
      if (!prev) return prev;
      const resetIds = stepIds ? new Set(stepIds) : null;
      return {
        ...prev,
        steps: prev.steps.map(s => {
          // stepIds 为空表示执行所有 pending 步骤，不做额外重置
          if (resetIds && resetIds.has(s.step_id)) {
            return { ...s, status: 'pending' as const, output: null };
          }
          return s;
        }),
      };
    });

    const cancelExecute = agentApiClient.executeStream(
      sessionId,
      stepIds,
      // onChunk
      () => {},
      // onComplete
      (_response: string, _sid: string, _title?: string, plan?: any) => {
        cancelStreamRef.current = null;
        if (plan) {
          setPlanData(normalizePlanData(plan) || plan as PlanData);
        }
        setIsPlanExecuting(false);
      },
      // onError
      (error: string) => {
        cancelStreamRef.current = null;
        console.error('执行计划失败:', error);
        alert(`执行计划失败: ${error}`);
        setIsPlanExecuting(false);
      },
      // onStatus
      (data: { node?: string; step_id?: number; status?: string; type: string }) => {
        if (data.type === 'step_update' && data.step_id != null) {
          setPlanData(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              steps: prev.steps.map(s =>
                s.step_id === data.step_id && data.status
                  ? { ...s, status: data.status as any }
                  : s
              ),
            };
          });
          const stepId = data.step_id as number;
          const stepStatus = data.status as 'running' | 'complete' | 'error';
          setStepOutputs(prev => {
            const next = new Map(prev);
            const existing = next.get(stepId);
            if (stepStatus === 'running') {
              next.set(stepId, { step_id: stepId, content: '', status: 'running' });
            } else if (existing) {
              next.set(stepId, {
                ...existing,
                status: stepStatus,
                content: (data as any).output ?? existing.content,
              });
            }
            return next;
          });
        } else if (data.type === 'step_chunk' && (data as any).step_id != null) {
          const stepId = (data as any).step_id as number;
          const token = (data as any).content as string;
          setStepOutputs(prev => {
            const next = new Map(prev);
            const existing = next.get(stepId);
            if (existing) {
              next.set(stepId, { ...existing, content: existing.content + token });
            } else {
              next.set(stepId, { step_id: stepId, content: token, status: 'running' });
            }
            return next;
          });
        } else if (data.type === 'tool_call' && (data as any).step_id != null) {
          const stepId = (data as any).step_id as number;
          const event = (data as any).event as 'start' | 'end';
          const toolName = (data as any).tool as string;
          setToolCalls(prev => {
            const next = new Map(prev);
            const list = [...(next.get(stepId) ?? [])];
            if (event === 'start') {
              list.push({
                id: `${stepId}-${list.length}`,
                tool: toolName,
                arguments: (data as any).arguments ?? {},
                status: 'running',
                isDocker: toolName === 'run_docker_tool',
              });
            } else if (event === 'end') {
              for (let i = list.length - 1; i >= 0; i--) {
                if (list[i].tool === toolName && list[i].status === 'running') {
                  list[i] = {
                    ...list[i],
                    status: (data as any).success ? 'complete' : 'error',
                    output: (data as any).output,
                    error: (data as any).error,
                    duration_ms: (data as any).duration_ms,
                  };
                  break;
                }
              }
            }
            next.set(stepId, list);
            return next;
          });
        } else if (data.type === 'observe' && (data as any).step_id != null) {
          // Observe 评估结果：附加到该步骤最近一次已完成的工具调用上
          const stepId = (data as any).step_id as number;
          const decision = (data as any).decision as 'continue' | 'retry' | 'fail';
          const reason = (data as any).reason as string;
          setToolCalls(prev => {
            const next = new Map(prev);
            const list = [...(next.get(stepId) ?? [])];
            for (let i = list.length - 1; i >= 0; i--) {
              if (list[i].status !== 'running' && !list[i].observeDecision) {
                list[i] = { ...list[i], observeDecision: decision, observeReason: reason };
                break;
              }
            }
            next.set(stepId, list);
            return next;
          });
        }
      },
      // onSession
      undefined,
      // projectId
      currentProjectId ? parseInt(currentProjectId, 10) : undefined,
    );
    cancelStreamRef.current = cancelExecute;
  }, [sessionId, currentProjectId]);

  // 在项目中开始新对话
  const handleStartChatInProject = useCallback(async (initialMessage: string) => {
    if (!currentProjectId) return;
    
    // 重置会话状态
    dbSessionIdRef.current = null;
    
    // 退出项目视图，进入聊天视图
    setCurrentProjectId(undefined);
    
    // 清空消息列表（handleSendMessage 会添加用户消息和流式占位消息）
    setMessages([]);
    
    // 新对话由后端 chat_stream 预创建 DB 记录，此处不再单独创建
    setSessionId(undefined); // 重置 agent session，handleSendMessage 会自动创建
    
    // 发送消息（handleSendMessage 中 onSession 回调会设置 dbSessionIdRef）
    handleSendMessage(initialMessage);
  }, [currentProjectId, handleSendMessage]);

  // 获取当前选中的项目
  const currentProject = projects.find(p => p.id === currentProjectId);
  // 获取项目的聊天记录
  const currentProjectChats = currentProjectId 
    ? chatHistory.filter(c => c.projectId === currentProjectId)
    : [];

  return (
    <div className="h-screen w-screen flex overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        currentModule={currentModule}
        onModuleChange={handleModuleChange}
        projects={projects}
        chatHistory={chatHistory}
        onNewChat={handleNewChat}
        onSelectChat={handleSelectChat}
        onSelectProject={handleSelectProject}
        onDeleteChat={handleDeleteChat}
        onCreateProject={handleCreateProject}
        onDeleteProject={handleDeleteProject}
        onRenameProject={handleRenameProject}
        onMergeProject={handleMergeProject}
        onMoveToProject={handleMoveToProject}
        onRenameChat={handleRenameChat}
        onOpenSkillLibrary={() => {
          setShowSkillLibrary(true);
          setCurrentChatId(undefined);
          setCurrentProjectId(undefined);
        }}
        currentChatId={currentChatId}
        currentProjectId={currentProjectId}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Conditional content based on module and project view */}
        {showSkillLibrary ? (
          <SkillLibrary
            isAdmin={user?.role === 'admin'}
            isGuest={isGuest}
          />
        ) : currentProject && !currentChatId ? (
          // 项目视图
          <ProjectView
            project={currentProject}
            projectChats={currentProjectChats}
            onBack={handleExitProjectView}
            onSelectChat={(chat) => {
              handleSelectChat(chat);
              setCurrentProjectId(undefined);
            }}
            onDeleteChat={handleDeleteChat}
            onRenameChat={handleRenameChat}
            onStartNewChat={handleStartChatInProject}
            onUpdateAutoExecute={handleUpdateAutoExecute}
            currentChatId={currentChatId}
            referencedFiles={referencedFiles}
            onAddReferencedFile={handleAddReferencedFile}
            onRemoveReferencedFile={handleRemoveReferencedFile}
            onClearReferencedFiles={handleClearReferencedFiles}
          />
        ) : (
          <ChatArea
            messages={messages}
            onSendMessage={handleSendMessage}
            isLoading={isLoading}
            onStop={handleStopGeneration}
            currentModule={currentModule}
            currentProjectId={currentProjectId}
            dbConversationId={dbSessionIdRef.current}
            sessionId={sessionId}
            referencedFiles={referencedFiles}
            onAddReferencedFile={handleAddReferencedFile}
            onRemoveReferencedFile={handleRemoveReferencedFile}
            onClearReferencedFiles={handleClearReferencedFiles}
            stepOutputs={stepOutputs}
            planSteps={planData?.steps ?? []}
            toolCalls={toolCalls}
          />
        )}
      </div>

      {/* Login Prompt Modal for Guest */}
      <LoginPromptModal isOpen={showLoginPrompt} onClose={() => setShowLoginPrompt(false)} />

      {/* Workspace Panel */}
      <WorkspacePanel
        isOpen={isWorkspacePanelOpen}
        onToggle={() => setIsWorkspacePanelOpen(prev => !prev)}
        activeTab={workspaceActiveTab}
        onTabChange={setWorkspaceActiveTab}
        currentProjectId={currentProjectId}
        planData={planData}
        isPlanEditable={isPlanEditable}
        isPlanExecuting={isPlanExecuting}
        onPlanConfirm={handlePlanConfirm}
        onPlanExit={handlePlanExit}
        onPlanExecute={handleExecutePlan}
        onCancelExecution={handleCancelExecution}
        onFileSelect={handleWorkspaceFileSelect}
        dbConversationId={dbSessionIdRef.current}
        sessionId={sessionId}
      />
    </div>
  );
}

// 包装应用组件，添加路由和认证守卫
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/upgrade" element={<AuthGuard><UpgradePage /></AuthGuard>} />
        <Route path="/payment/:orderNo" element={<AuthGuard><PaymentPage /></AuthGuard>} />
        <Route path="/*" element={
          <AuthGuard>
            <MainApp />
          </AuthGuard>
        } />
      </Routes>
    </BrowserRouter>
  );
}
