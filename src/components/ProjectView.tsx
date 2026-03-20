import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, MessageCircle, Trash2, MoreVertical, Edit3, Zap } from 'lucide-react';
import { Project, ChatSession, ReferencedFile } from '@/types';
import ChatInput from './ChatInput';
import clsx from 'clsx';

interface ProjectViewProps {
  project: Project;
  projectChats: ChatSession[];
  onBack: () => void;
  onSelectChat: (chat: ChatSession) => void;
  onDeleteChat?: (chatId: string) => void;
  onRenameChat?: (chatId: string, newTitle: string) => void;
  onStartNewChat: (initialMessage: string) => void;
  onUpdateAutoExecute?: (autoExecute: boolean) => void;
  currentChatId?: string;
  referencedFiles?: ReferencedFile[];
  onAddReferencedFile?: (file: ReferencedFile) => void;
  onRemoveReferencedFile?: (workspacePath: string) => void;
  onClearReferencedFiles?: () => void;
}

export default function ProjectView({
  project,
  projectChats,
  onBack,
  onSelectChat,
  onDeleteChat,
  onRenameChat,
  onStartNewChat,
  onUpdateAutoExecute,
  currentChatId,
  referencedFiles,
  onAddReferencedFile,
  onRemoveReferencedFile,
  onClearReferencedFiles,
}: ProjectViewProps) {
  const [openMenuChatId, setOpenMenuChatId] = useState<string | null>(null);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuChatId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 格式化时间
  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return '今天';
    } else if (days === 1) {
      return '昨天';
    } else if (days < 7) {
      return `${days}天前`;
    } else {
      return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-gradient-to-b from-platinum-100 to-white">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-platinum-300 bg-white/80 backdrop-blur-sm">
        <button
          onClick={onBack}
          className="p-2 hover:bg-platinum-200 rounded-lg transition-colors text-text-secondary hover:text-text-primary"
          title="返回"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 bg-gradient-to-br from-rosegold-300 to-rosegold-500 rounded-xl flex items-center justify-center shadow-sm">
            <span className="text-white font-bold text-lg">B</span>
          </div>
          <div>
            <h1 className="text-xl font-semibold text-text-primary">BioAgent</h1>
            <p className="text-sm text-text-secondary">{project.name}</p>
          </div>
        </div>
        {/* 无限模式 Toggle */}
        <div className="flex items-center gap-2">
          <Zap size={16} className={clsx(
            'transition-colors',
            project.autoExecute ? 'text-amber-500' : 'text-text-muted'
          )} />
          <span className="text-sm text-text-secondary whitespace-nowrap">无限模式</span>
          <button
            onClick={() => onUpdateAutoExecute?.(!project.autoExecute)}
            className={clsx(
              'relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200',
              project.autoExecute ? 'bg-amber-500' : 'bg-platinum-300'
            )}
            title={project.autoExecute ? '无限模式：跳过计划确认直接执行' : '标准模式：执行前需确认计划'}
          >
            <span
              className={clsx(
                'inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200',
                project.autoExecute ? 'translate-x-6' : 'translate-x-1'
              )}
            />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-8 overflow-auto">
        {/* Welcome Section */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-rosegold-300 to-rosegold-500 rounded-2xl flex items-center justify-center shadow-lg mx-auto mb-4">
            <span className="text-white font-bold text-2xl">B</span>
          </div>
          <h2 className="text-2xl font-semibold text-text-primary mb-2">
            {project.name}
          </h2>
          <p className="text-text-secondary">
            {project.description || '开始新对话或查看历史记录'}
          </p>
        </div>

        {/* Input Area */}
        <div className="w-full max-w-2xl mb-8">
          <ChatInput
            onSubmit={onStartNewChat}
            placeholder="输入消息开始新对话..."
            currentProjectId={project.id}
            maxHeight={150}
            referencedFiles={referencedFiles}
            onAddReferencedFile={onAddReferencedFile}
            onRemoveReferencedFile={onRemoveReferencedFile}
            onClearReferencedFiles={onClearReferencedFiles}
          />
        </div>

        {/* Chat History Section */}
        <div className="w-full max-w-2xl">
          <div className="flex items-center gap-2 mb-4 px-2">
            <MessageCircle size={18} className="text-text-secondary" />
            <h3 className="text-sm font-medium text-text-secondary uppercase tracking-wide">
              对话记录 ({projectChats.length})
            </h3>
          </div>

          {projectChats.length === 0 ? (
            <div className="text-center py-12 text-text-muted">
              <MessageCircle size={48} className="mx-auto mb-4 opacity-30" />
              <p>暂无对话记录</p>
              <p className="text-sm mt-1">在上方输入消息开始新对话</p>
            </div>
          ) : (
            <div className="space-y-2">
              {projectChats.map((chat) => (
                <div
                  key={chat.id}
                  className={clsx(
                    'group bg-white rounded-xl border transition-all cursor-pointer',
                    currentChatId === chat.id
                      ? 'border-rosegold-300 shadow-md'
                      : 'border-platinum-200 hover:border-platinum-300 hover:shadow-sm'
                  )}
                >
                  {renamingChatId === chat.id ? (
                    <div className="p-4">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && renameValue.trim()) {
                            onRenameChat?.(chat.id, renameValue.trim());
                            setRenamingChatId(null);
                          } else if (e.key === 'Escape') {
                            setRenamingChatId(null);
                          }
                        }}
                        onBlur={() => {
                          if (renameValue.trim() && renameValue !== chat.title) {
                            onRenameChat?.(chat.id, renameValue.trim());
                          }
                          setRenamingChatId(null);
                        }}
                        className="w-full px-3 py-2 text-sm border border-rosegold-300 rounded-lg focus:outline-none focus:border-rosegold-400"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  ) : (
                    <div
                      onClick={() => onSelectChat(chat)}
                      className="flex items-center justify-between p-4"
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-text-primary truncate">
                          {chat.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-text-muted">
                            {formatTime(chat.updatedAt)}
                          </span>
                          <span className="text-xs text-text-muted">
                            · {chat.messages.length} 条消息
                          </span>
                        </div>
                      </div>

                      {/* 三点菜单 */}
                      <div className="relative" ref={openMenuChatId === chat.id ? menuRef : undefined}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuChatId(openMenuChatId === chat.id ? null : chat.id);
                          }}
                          className={clsx(
                            'p-2 rounded-lg transition-all',
                            openMenuChatId === chat.id
                              ? 'opacity-100 bg-platinum-200'
                              : 'opacity-0 group-hover:opacity-100 hover:bg-platinum-200'
                          )}
                        >
                          <MoreVertical size={16} className="text-text-secondary" />
                        </button>

                        {openMenuChatId === chat.id && (
                          <div 
                            className="absolute right-0 top-full mt-1 bg-white shadow-xl rounded-lg border border-gray-200 py-1 min-w-[120px]"
                            style={{ zIndex: 9999 }}
                          >
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setRenameValue(chat.title);
                                setRenamingChatId(chat.id);
                                setOpenMenuChatId(null);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100 text-gray-700"
                            >
                              <Edit3 size={14} />
                              重命名
                            </button>
                            {onDeleteChat && (
                              <>
                                <div className="h-px bg-gray-200 my-1" />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteChat(chat.id);
                                    setOpenMenuChatId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-red-50 text-red-500"
                                >
                                  <Trash2 size={14} />
                                  删除
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
