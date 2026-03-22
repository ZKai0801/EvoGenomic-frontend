import React, { lazy, Suspense, useRef, useEffect, useCallback } from 'react';
import { Bot, User } from 'lucide-react';
import { Message, ModuleType, ReferencedFile, StepOutput, PlanStep, ToolCallInfo, NodeOutputInfo } from '@/types';
import ImageDisplay from './ImageDisplay';
import ConfigPanel from './ConfigPanel';
import ChatHistoryNavigator from './ChatHistoryNavigator';
import QuestionCard from './QuestionCard';
import ExecutorStepOutput from './ExecutorStepOutput';
import ChatInput from './ChatInput';
import clsx from 'clsx';

const MarkdownRenderer = lazy(() => import('./MarkdownRenderer'));

type UserMessageDisplay = {
  text: string;
  fileNames: string[];
};

function parseUserMessageDisplay(content: string): UserMessageDisplay {
  // 匹配所有文件引用头（上传文件 + 引用文件）
  const fileHeaderRegex = /^\[(?:已上传数据文件|引用文件):\s*(.+?)\]\n(?:文件路径|工作区路径):\s*[^\n]+\n(?:文件大小:\s*[^\n]+\n)?(?:\n)?/gm;
  const fileNames: string[] = [];
  let text = content;
  let match;
  while ((match = fileHeaderRegex.exec(content)) !== null) {
    fileNames.push(match[1].trim());
  }
  text = content.replace(/^\[(?:已上传数据文件|引用文件):\s*.+?\]\n(?:文件路径|工作区路径):\s*[^\n]+\n(?:文件大小:\s*[^\n]+\n)?(?:\n)?/gm, '').trim();
  return { text, fileNames };
}

interface ChatAreaProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  isLoading: boolean;
  onStop?: () => void;
  currentModule: ModuleType;
  onMessageWithAgent?: (message: Message) => void;
  currentProjectId?: string;
  dbConversationId?: number | null;
  sessionId?: string;
  referencedFiles?: ReferencedFile[];
  onAddReferencedFile?: (file: ReferencedFile) => void;
  onRemoveReferencedFile?: (workspacePath: string) => void;
  onClearReferencedFiles?: () => void;
  stepOutputs?: Map<number, StepOutput>;
  planSteps?: PlanStep[];
  toolCalls?: Map<number, ToolCallInfo[]>;
}

const moduleWelcomeMessages: Record<ModuleType, { title: string; description: string; suggestions: string[] }> = {
  chat: {
    title: '你好，我是 BioAgent',
    description: '我是您的智能生物信息学助手，可以帮助您进行数据分析、流程设计和科研绘图。',
    suggestions: [
      '如何进行RNA-Seq差异表达分析？',
      '帮我设计一个单细胞分析流程',
      '解释一下GSEA富集分析的原理',
    ],
  },
  statistics: {
    title: '统计检测工具',
    description: '执行常用统计学检测，包括假设检验、相关分析、生存分析等。',
    suggestions: [
      '对两组样本进行t检验',
      '计算基因表达量的Spearman相关系数',
      '做Kaplan-Meier生存分析',
    ],
  },
};

export default function ChatArea({
  messages,
  onSendMessage,
  isLoading,
  onStop,
  currentModule,
  currentProjectId,
  dbConversationId,
  sessionId,
  referencedFiles = [],
  onAddReferencedFile,
  onRemoveReferencedFile,
  onClearReferencedFiles,
  stepOutputs,
  planSteps = [],
  toolCalls,
}: ChatAreaProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const welcomeInfo = moduleWelcomeMessages[currentModule];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Memoized ref callback to avoid re-creating on each render
  const setMessageRef = useCallback((id: string) => (el: HTMLDivElement | null) => {
    if (el) {
      messageRefs.current.set(id, el);
    } else {
      messageRefs.current.delete(id);
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSuggestionClick = (suggestion: string) => {
    onSendMessage(suggestion);
  };

  // 跳转到指定消息
  const handleJumpToMessage = (messageId: string) => {
    const messageElement = messageRefs.current.get(messageId);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // 高亮显示消息
      messageElement.classList.add('ring-2', 'ring-rosegold-400');
      setTimeout(() => {
        messageElement.classList.remove('ring-2', 'ring-rosegold-400');
      }, 2000);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-chat-bg">
      {/* Header with Chat History Navigator */}
      {messages.length > 0 && (
        <div className="flex items-center justify-between px-6 py-3 border-b border-platinum-300 bg-white/80 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <ChatHistoryNavigator
              messages={messages}
              onJumpToMessage={handleJumpToMessage}
            />
          </div>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          // Welcome screen
          <div className="h-full flex flex-col items-center justify-center px-4 py-8">
            <div className="max-w-2xl w-full text-center">
              <div className="w-16 h-16 bg-gradient-to-br from-rosegold-300 to-rosegold-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-rosegold-200/50">
                <Bot size={32} className="text-white" />
              </div>
              <h1 className="text-3xl font-semibold text-text-primary mb-3">
                {welcomeInfo.title}
              </h1>
              <p className="text-text-secondary text-lg mb-8">
                {welcomeInfo.description}
              </p>
              
              {/* Suggestions */}
              <div className="grid gap-3">
                {welcomeInfo.suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="p-4 bg-white hover:bg-platinum-200 rounded-xl text-left transition-all duration-200 border border-platinum-400 hover:border-rosegold-300 shadow-luxury hover:shadow-luxury-md group"
                  >
                    <span className="text-text-primary group-hover:text-rosegold-500 transition-colors">{suggestion}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          // Messages list
          <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
            {messages.map((message) => (
              <div
                key={message.id}
                ref={setMessageRef(message.id)}
                className={clsx(
                  'flex gap-4 transition-all duration-300 rounded-2xl',
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {message.role === 'user' ? (
                  <>
                    <div className="flex flex-col items-end max-w-[88%]">
                      <div className="rounded-2xl px-4 py-3 bg-[#F1E7C8] text-text-primary border border-[#E0D4B5] shadow-sm">
                        <div className="whitespace-pre-wrap">{parseUserMessageDisplay(message.content).text}</div>
                      </div>
                      {parseUserMessageDisplay(message.content).fileNames.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1 justify-end">
                          {parseUserMessageDisplay(message.content).fileNames.map((fname, i) => (
                            <div key={i} className="inline-flex items-center rounded-md bg-slate-200 px-2 py-1 text-xs text-slate-700">
                              {fname}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="w-8 h-8 bg-gradient-to-br from-slate-400 to-slate-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm">
                      <User size={18} className="text-white" />
                    </div>
                  </>
                ) : (
                  <div className="max-w-[88%] px-1 py-1 text-text-primary">
                    {/* 思考状态：无内容且无节点输出时显示 */}
                    {message.isAgentWorking && !message.content && !(message.nodeOutputs?.length) && (
                      <div className="flex items-center gap-2 text-sm text-text-secondary">
                        <div className="w-2 h-2 bg-rosegold-400 rounded-full animate-pulse" />
                        <span>{message.thinkingStatus || '正在思考...'}</span>
                      </div>
                    )}
                    {/* 按节点执行顺序展示各阶段详情 */}
                    {(() => {
                      const nodeOutputs = message.nodeOutputs || [];
                      const nodeOrder = ['think', 'planner', 'executor', 'reviewer', 'answer'];
                      const labels: Record<string, string> = {
                        think: '🧠 思考',
                        planner: '📋 规划',
                        executor: '⚙️ 执行',
                        reviewer: '🔍 审查',
                        answer: '💬 回答',
                      };

                      const grouped = new Map<string, NodeOutputInfo[]>();
                      nodeOutputs.forEach(no => {
                        const list = grouped.get(no.node) || [];
                        list.push(no);
                        grouped.set(no.node, list);
                      });

                      const hasLiveOutputs = message.isAgentWorking && stepOutputs && stepOutputs.size > 0;
                      const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');
                      const isLastAssistant = lastAssistantMsg?.id === message.id;
                      const hasCompletedSteps = planSteps.some(s => s.output && s.status !== 'pending' && s.status !== 'running');
                      const hasStepOutputData = isLastAssistant && stepOutputs && stepOutputs.size > 0;
                      const showHistorical = !message.isAgentWorking && isLastAssistant && hasCompletedSteps;
                      const showExecutorSteps = hasLiveOutputs || showHistorical || hasStepOutputData;

                      const elements: React.ReactNode[] = [];

                      for (const nodeName of nodeOrder) {
                        // 在 executor 摘要之前插入步骤详情
                        if (nodeName === 'executor' && showExecutorSteps) {
                          elements.push(
                            <ExecutorStepOutput
                              key="executor-steps"
                              stepOutputs={stepOutputs ?? new Map()}
                              planSteps={planSteps}
                              toolCalls={toolCalls}
                            />
                          );
                        }

                        const items = grouped.get(nodeName);
                        if (items) {
                          items.forEach((no, idx) => {
                            elements.push(
                              <details key={`${nodeName}-${idx}`} className="text-sm border border-platinum-400 rounded-lg overflow-hidden">
                                <summary className="px-3 py-1.5 bg-platinum-200/50 cursor-pointer text-text-secondary hover:text-text-primary select-none">
                                  {labels[no.node] || no.node}
                                </summary>
                                <div className="px-3 py-2 text-text-secondary">
                                  <span className="text-xs whitespace-pre-wrap">{no.content}</span>
                                </div>
                              </details>
                            );
                          });
                          grouped.delete(nodeName);
                        }
                      }

                      // 处理未知节点名
                      for (const [, items] of grouped) {
                        items.forEach((no, idx) => {
                          elements.push(
                            <details key={`other-${no.node}-${idx}`} className="text-sm border border-platinum-400 rounded-lg overflow-hidden">
                              <summary className="px-3 py-1.5 bg-platinum-200/50 cursor-pointer text-text-secondary hover:text-text-primary select-none">
                                {labels[no.node] || no.node}
                              </summary>
                              <div className="px-3 py-2 text-text-secondary">
                                <span className="text-xs whitespace-pre-wrap">{no.content}</span>
                              </div>
                            </details>
                          );
                        });
                      }

                      // 仅有步骤输出但尚无节点摘要
                      if (elements.length === 0 && showExecutorSteps) {
                        elements.push(
                          <ExecutorStepOutput
                            key="executor-steps-only"
                            stepOutputs={stepOutputs ?? new Map()}
                            planSteps={planSteps}
                            toolCalls={toolCalls}
                          />
                        );
                      }

                      return elements.length > 0 ? (
                        <div className="space-y-1.5 mb-2">{elements}</div>
                      ) : null;
                    })()}
                    {/* 有节点输出但仍在工作中且无内容时显示思考状态 */}
                    {message.isAgentWorking && !message.content && (message.nodeOutputs?.length || 0) > 0 && (
                      <div className="flex items-center gap-2 text-sm text-text-secondary mt-1">
                        <div className="w-2 h-2 bg-rosegold-400 rounded-full animate-pulse" />
                        <span>{message.thinkingStatus || '正在处理...'}</span>
                      </div>
                    )}
                    {/* 最终回复内容 */}
                    {message.content && (
                      <Suspense
                        fallback={
                          <div className="whitespace-pre-wrap break-words leading-relaxed">
                            {message.content}
                          </div>
                        }
                      >
                        <MarkdownRenderer content={message.content} />
                      </Suspense>
                    )}
                    {message.isAgentWorking && message.content && (
                      <span className="inline-block w-2 h-4 ml-1 bg-rosegold-500 animate-pulse" />
                    )}
                    {message.imageBase64 && (
                      <ImageDisplay
                        imageBase64={message.imageBase64}
                        script={message.generatedScript}
                      />
                    )}
                    {message.mcpPendingConfig && (
                      <ConfigPanel
                        config={message.mcpPendingConfig}
                        onConfirm={(modifiedConfig) => {
                          onSendMessage(JSON.stringify({
                            type: 'mcp_confirm',
                            config: modifiedConfig,
                          }));
                        }}
                        onCancel={() => {
                          onSendMessage('取消该操作');
                        }}
                      />
                    )}
                    {message.questionData && (
                      <QuestionCard
                        question={message.questionData}
                        onAnswer={(answer) => {
                          onSendMessage(answer);
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            ))}
            
            {/* Loading indicator */}
            {isLoading && (
              <div className="flex gap-4">
                <div className="px-1 py-2">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-text-secondary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-text-secondary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-text-secondary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-platinum-400 p-4 bg-gradient-to-t from-platinum-200/50 to-transparent">
        <div className="max-w-3xl mx-auto">
          <ChatInput
            onSubmit={onSendMessage}
            isLoading={isLoading}
            onStop={onStop}
            placeholder="输入消息..."
            referencedFiles={referencedFiles}
            onAddReferencedFile={onAddReferencedFile}
            onRemoveReferencedFile={onRemoveReferencedFile}
            onClearReferencedFiles={onClearReferencedFiles}
            currentProjectId={currentProjectId}
            dbConversationId={dbConversationId}
            sessionId={sessionId}
            showDisclaimer
          />
        </div>
      </div>
    </div>
  );
}
