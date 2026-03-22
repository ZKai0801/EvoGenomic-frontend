import { 
  MessageSquarePlus, 
  ChevronDown,
  ChevronRight,
  FolderOpen,
  MessageCircle,
  Settings,
  HelpCircle,
  LogOut,
  User,
  PanelLeftClose,
  PanelLeft,
  Trash2,
  FolderPlus,
  MoreVertical,
  Edit3,
  FolderInput,
  BookOpen
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ModuleType, Project, ChatSession } from '@/types';
import clsx from 'clsx';
import { useAuth } from './AuthGuard';

interface SidebarProps {
  currentModule: ModuleType;
  onModuleChange: (module: ModuleType) => void;
  projects: Project[];
  chatHistory: ChatSession[];
  onNewChat: () => void;
  onSelectChat: (chat: ChatSession) => void;
  onSelectProject: (project: Project) => void;
  onDeleteChat?: (chatId: string) => void;
  onCreateProject?: (name: string, description?: string) => string | Promise<string>;
  onDeleteProject?: (projectId: string) => void;
  onRenameProject?: (projectId: string, newName: string) => void;
  onMergeProject?: (sourceProjectId: string, targetProjectId: string) => void;
  onMoveToProject?: (chatId: string, projectId: string | undefined) => void;
  onRenameChat?: (chatId: string, newTitle: string) => void;
  onOpenSkillLibrary?: () => void;
  currentChatId?: string;
  currentProjectId?: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const moduleItems = [
  { id: 'chat' as ModuleType, name: '新聊天', icon: MessageSquarePlus, color: 'text-rosegold-400' },
];

export default function Sidebar({
  currentModule,
  onModuleChange,
  projects,
  chatHistory,
  onNewChat,
  onSelectChat,
  onSelectProject,
  onDeleteChat,
  onCreateProject,
  onDeleteProject,
  onRenameProject,
  onMergeProject,
  onMoveToProject,
  onRenameChat,
  onOpenSkillLibrary,
  currentChatId,
  currentProjectId,
  isCollapsed,
  onToggleCollapse,
}: SidebarProps) {
  const { user, isGuest, logout } = useAuth();
  const navigate = useNavigate();
  const [isProjectsExpanded, setIsProjectsExpanded] = useState(true);
  const [isChatHistoryExpanded, setIsChatHistoryExpanded] = useState(true);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [openMenuChatId, setOpenMenuChatId] = useState<string | null>(null);
  const [openMenuProjectId, setOpenMenuProjectId] = useState<string | null>(null);
  const [showMoveSubmenu, setShowMoveSubmenu] = useState(false);
  const [showProjectMoveSubmenu, setShowProjectMoveSubmenu] = useState(false);
  const [renamingChatId, setRenamingChatId] = useState<string | null>(null);
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [dragOverProjectId, setDragOverProjectId] = useState<string | null>(null);
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(new Set());
  const menuRef = useRef<HTMLDivElement>(null);

  // 未归类的聊天记录（不属于任何项目）
  const uncategorizedChats = chatHistory.filter(c => !c.projectId);

  // 获取项目下的聊天记录
  const getProjectChats = (projectId: string) => chatHistory.filter(c => c.projectId === projectId);

  // 切换项目展开状态
  const toggleProjectExpanded = (projectId: string) => {
    setExpandedProjectIds(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  };

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuChatId(null);
        setOpenMenuProjectId(null);
        setShowMoveSubmenu(false);
        setShowProjectMoveSubmenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 处理拖拽开始
  const handleDragStart = (e: React.DragEvent, chatId: string) => {
    e.dataTransfer.setData('chatId', chatId);
    e.dataTransfer.effectAllowed = 'move';
  };

  // 处理拖拽经过项目
  const handleDragOver = (e: React.DragEvent, projectId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverProjectId(projectId);
  };

  // 处理拖拽离开
  const handleDragLeave = () => {
    setDragOverProjectId(null);
  };

  // 处理放置到项目
  const handleDrop = (e: React.DragEvent, projectId: string) => {
    e.preventDefault();
    const chatId = e.dataTransfer.getData('chatId');
    if (chatId && onMoveToProject) {
      onMoveToProject(chatId, projectId);
    }
    setDragOverProjectId(null);
  };

  // 聊天项组件（可复用于项目内和未归类列表）
  const ChatItem = ({ chat, inProject = false }: { chat: ChatSession; inProject?: boolean }) => (
    <div
      draggable
      onDragStart={(e) => handleDragStart(e, chat.id)}
      className={clsx(
        'group w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors cursor-grab active:cursor-grabbing',
        currentChatId === chat.id
          ? 'bg-sidebar-active text-text-primary'
          : 'text-text-secondary hover:bg-sidebar-hover hover:text-text-primary',
        inProject && 'pl-6'
      )}
    >
      {renamingChatId === chat.id ? (
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
          className="flex-1 px-2 py-0.5 text-sm bg-white border border-rosegold-300 rounded focus:outline-none focus:border-rosegold-400"
          autoFocus
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <button
          onClick={() => onSelectChat(chat)}
          className="flex-1 text-left min-w-0"
        >
          <span className="text-sm truncate block">{chat.title}</span>
        </button>
      )}
      
      {/* 三点菜单 */}
      <div className="relative" ref={openMenuChatId === chat.id ? menuRef : undefined}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setOpenMenuChatId(openMenuChatId === chat.id ? null : chat.id);
            setShowMoveSubmenu(false);
          }}
          className={clsx(
            'p-1 rounded transition-all',
            openMenuChatId === chat.id 
              ? 'opacity-100 bg-sidebar-hover' 
              : 'opacity-0 group-hover:opacity-100 hover:bg-sidebar-hover'
          )}
        >
          <MoreVertical size={14} />
        </button>
        
        {/* 下拉菜单 */}
        {openMenuChatId === chat.id && (
          <div className="fixed bg-white shadow-xl rounded-lg border border-gray-200 py-1 min-w-[140px]" style={{ zIndex: 9999, top: 'auto', right: 'auto' }}>
            {/* 重命名 */}
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
            
            {/* 移至项目 */}
            <div 
              className="relative"
              onMouseEnter={() => setShowMoveSubmenu(true)}
              onMouseLeave={() => setShowMoveSubmenu(false)}
            >
              <button
                className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100 text-gray-700"
              >
                <span className="flex items-center gap-2">
                  <FolderInput size={14} />
                  移至项目
                </span>
                <ChevronRight size={14} />
              </button>
              
              {/* 子菜单 */}
              {showMoveSubmenu && (
                <div className="absolute left-full top-0 ml-1 bg-white shadow-xl rounded-lg border border-gray-200 py-1 min-w-[120px]" style={{ zIndex: 9999 }}>
                  {/* 新项目 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuChatId(null);
                      setShowMoveSubmenu(false);
                      // 创建新项目并移动
                      const projectName = prompt('请输入新项目名称：');
                      if (projectName?.trim() && onCreateProject && onMoveToProject) {
                        const result = onCreateProject(projectName.trim());
                        // 支持异步创建项目
                        Promise.resolve(result).then(newProjectId => {
                          onMoveToProject(chat.id, newProjectId);
                        });
                      }
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100 text-rosegold-500"
                  >
                    <FolderPlus size={14} />
                    新项目
                  </button>
                  
                  {projects.length > 0 && <div className="h-px bg-gray-200 my-1" />}
                  
                  {/* 移出项目 */}
                  {chat.projectId && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onMoveToProject?.(chat.id, undefined);
                          setOpenMenuChatId(null);
                          setShowMoveSubmenu(false);
                        }}
                        className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 text-gray-500"
                      >
                        移出项目
                      </button>
                      {projects.length > 0 && <div className="h-px bg-gray-200 my-1" />}
                    </>
                  )}
                  
                  {/* 已有项目 */}
                  {projects.map((proj) => (
                    <button
                      key={proj.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onMoveToProject?.(chat.id, proj.id);
                        setOpenMenuChatId(null);
                        setShowMoveSubmenu(false);
                      }}
                      className={clsx(
                        'w-full px-3 py-2 text-left text-sm hover:bg-gray-100',
                        chat.projectId === proj.id ? 'text-rosegold-500 font-medium' : 'text-gray-700'
                      )}
                    >
                      {proj.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <div className="h-px bg-gray-200 my-1" />
            
            {/* 删除 */}
            {onDeleteChat && (
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
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <aside
      className={clsx(
        'h-full bg-sidebar flex flex-col border-r border-sidebar-active transition-all duration-300 relative z-50',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header with collapse button */}
      <div className="flex items-center justify-between p-3 border-b border-sidebar-active">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-rosegold-300 to-rosegold-500 rounded-lg flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-sm">B</span>
            </div>
            <span className="text-text-primary font-semibold tracking-tight">BioAgent</span>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className="p-2 hover:bg-sidebar-hover rounded-lg transition-colors text-text-secondary hover:text-text-primary"
          title={isCollapsed ? '展开侧边栏' : '收起侧边栏'}
        >
          {isCollapsed ? <PanelLeft size={20} /> : <PanelLeftClose size={20} />}
        </button>
      </div>

      {/* Module buttons */}
      <div className="p-2 space-y-1">
        {moduleItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentModule === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                onModuleChange(item.id);
                if (item.id === 'chat') {
                  onNewChat();
                }
              }}
              className={clsx(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                isActive 
                  ? 'bg-sidebar-active text-text-primary' 
                  : 'text-text-secondary hover:bg-sidebar-hover hover:text-text-primary'
              )}
              title={isCollapsed ? item.name : undefined}
            >
              <Icon size={20} className={item.color} />
              {!isCollapsed && <span className="text-sm font-medium">{item.name}</span>}
            </button>
          );
        })}
        {/* 技能库入口 */}
        <button
          onClick={() => onOpenSkillLibrary?.()}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-text-secondary hover:bg-sidebar-hover hover:text-text-primary"
          title={isCollapsed ? '技能库' : undefined}
        >
          <BookOpen size={20} className="text-emerald-500" />
          {!isCollapsed && <span className="text-sm font-medium">技能库</span>}
        </button>
      </div>

      <div className="h-px bg-sidebar-active mx-3 my-2" />

      {/* Projects section */}
      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto">
          {/* Projects */}
          <div className="px-2">
            <div className="flex items-center justify-between px-2 py-2">
              <button
                onClick={() => setIsProjectsExpanded(!isProjectsExpanded)}
                className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors"
              >
                {isProjectsExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                <FolderOpen size={16} />
                <span className="text-xs font-medium uppercase tracking-wide">项目</span>
              </button>
              {onCreateProject && (
                <button
                  onClick={() => setIsCreatingProject(true)}
                  className="p-1 text-text-secondary hover:text-text-primary hover:bg-sidebar-hover rounded transition-colors"
                  title="新建项目"
                >
                  <FolderPlus size={14} />
                </button>
              )}
            </div>
            {isProjectsExpanded && (
              <div className="space-y-0.5 mt-1">
                {/* 新建项目输入框 */}
                {isCreatingProject && (
                  <div className="px-3 py-2">
                    <input
                      type="text"
                      value={newProjectName}
                      onChange={(e) => setNewProjectName(e.target.value)}
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter' && newProjectName.trim()) {
                          await onCreateProject?.(newProjectName.trim());
                          setNewProjectName('');
                          setIsCreatingProject(false);
                        } else if (e.key === 'Escape') {
                          setNewProjectName('');
                          setIsCreatingProject(false);
                        }
                      }}
                      onBlur={() => {
                        if (!newProjectName.trim()) {
                          setIsCreatingProject(false);
                        }
                      }}
                      placeholder="输入项目名称..."
                      className="w-full px-2 py-1 text-sm bg-sidebar-hover border border-sidebar-active rounded focus:outline-none focus:border-rosegold-400"
                      autoFocus
                    />
                  </div>
                )}
                {projects.map((project) => {
                  const projectChats = getProjectChats(project.id);
                  const isExpanded = expandedProjectIds.has(project.id);
                  const isDragOver = dragOverProjectId === project.id;
                  const otherProjects = projects.filter(p => p.id !== project.id);
                  return (
                    <div key={project.id}>
                      {/* 项目行 */}
                      <div
                        onDragOver={(e) => handleDragOver(e, project.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, project.id)}
                        className={clsx(
                          'group w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all',
                          isDragOver
                            ? 'bg-rosegold-100 border-2 border-dashed border-rosegold-400'
                            : currentProjectId === project.id
                              ? 'bg-sidebar-active text-text-primary'
                              : 'text-text-secondary hover:bg-sidebar-hover hover:text-text-primary'
                        )}
                      >
                        <button
                          onClick={() => toggleProjectExpanded(project.id)}
                          className="p-0.5 hover:bg-sidebar-active rounded"
                        >
                          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </button>
                        
                        {/* 项目名称（可重命名） */}
                        {renamingProjectId === project.id ? (
                          <input
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && renameValue.trim()) {
                                onRenameProject?.(project.id, renameValue.trim());
                                setRenamingProjectId(null);
                              } else if (e.key === 'Escape') {
                                setRenamingProjectId(null);
                              }
                            }}
                            onBlur={() => {
                              if (renameValue.trim() && renameValue !== project.name) {
                                onRenameProject?.(project.id, renameValue.trim());
                              }
                              setRenamingProjectId(null);
                            }}
                            className="flex-1 px-2 py-0.5 text-sm bg-white border border-rosegold-300 rounded focus:outline-none focus:border-rosegold-400"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <button
                            onClick={() => onSelectProject(project)}
                            className="flex-1 flex items-center gap-2 text-left"
                          >
                            <div className="w-2 h-2 rounded-full bg-rosegold-400 flex-shrink-0" />
                            <span className="text-sm truncate">{project.name}</span>
                            <span className="text-xs text-text-tertiary">({projectChats.length})</span>
                          </button>
                        )}
                        
                        {/* 三点菜单 */}
                        <div className="relative" ref={openMenuProjectId === project.id ? menuRef : undefined}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuProjectId(openMenuProjectId === project.id ? null : project.id);
                              setOpenMenuChatId(null);
                              setShowProjectMoveSubmenu(false);
                            }}
                            className={clsx(
                              'p-1 rounded transition-all',
                              openMenuProjectId === project.id 
                                ? 'opacity-100 bg-sidebar-hover' 
                                : 'opacity-0 group-hover:opacity-100 hover:bg-sidebar-hover'
                            )}
                          >
                            <MoreVertical size={14} />
                          </button>
                          
                          {/* 项目下拉菜单 */}
                          {openMenuProjectId === project.id && (
                            <div className="fixed bg-white shadow-xl rounded-lg border border-gray-200 py-1 min-w-[140px]" style={{ zIndex: 9999 }}>
                              {/* 重命名 */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRenameValue(project.name);
                                  setRenamingProjectId(project.id);
                                  setOpenMenuProjectId(null);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100 text-gray-700"
                              >
                                <Edit3 size={14} />
                                重命名
                              </button>
                              
                              {/* 移至项目（合并到其他项目） */}
                              {otherProjects.length > 0 && (
                                <div 
                                  className="relative"
                                  onMouseEnter={() => setShowProjectMoveSubmenu(true)}
                                  onMouseLeave={() => setShowProjectMoveSubmenu(false)}
                                >
                                  <button
                                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100 text-gray-700"
                                  >
                                    <span className="flex items-center gap-2">
                                      <FolderInput size={14} />
                                      移至项目
                                    </span>
                                    <ChevronRight size={14} />
                                  </button>
                                  
                                  {/* 子菜单 - 其他项目列表 */}
                                  {showProjectMoveSubmenu && (
                                    <div className="absolute left-full top-0 ml-1 bg-white shadow-xl rounded-lg border border-gray-200 py-1 min-w-[120px]" style={{ zIndex: 9999 }}>
                                      {otherProjects.map((targetProj) => (
                                        <button
                                          key={targetProj.id}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onMergeProject?.(project.id, targetProj.id);
                                            setOpenMenuProjectId(null);
                                            setShowProjectMoveSubmenu(false);
                                          }}
                                          className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 text-gray-700"
                                        >
                                          {targetProj.name}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              <div className="h-px bg-gray-200 my-1" />
                              
                              {/* 删除 */}
                              {onDeleteProject && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteProject(project.id);
                                    setOpenMenuProjectId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-red-50 text-red-500"
                                >
                                  <Trash2 size={14} />
                                  删除
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      {/* 项目内的聊天记录 */}
                      {isExpanded && projectChats.length > 0 && (
                        <div className="mt-0.5 space-y-0.5">
                          {projectChats.map((chat) => (
                            <ChatItem key={chat.id} chat={chat} inProject />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Chat History - 只显示未归类的聊天 */}
          <div className="px-2 mt-4">
            <button
              onClick={() => setIsChatHistoryExpanded(!isChatHistoryExpanded)}
              className="w-full flex items-center gap-2 px-2 py-2 text-text-secondary hover:text-text-primary transition-colors"
            >
              {isChatHistoryExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <MessageCircle size={16} />
              <span className="text-xs font-medium uppercase tracking-wide">聊天记录</span>
              <span className="text-xs text-text-tertiary">({uncategorizedChats.length})</span>
            </button>
            {isChatHistoryExpanded && (
              <div className="space-y-0.5 mt-1">
                {uncategorizedChats.map((chat) => (
                  <ChatItem key={chat.id} chat={chat} />
                ))}
                {uncategorizedChats.length === 0 && (
                  <div className="px-3 py-2 text-xs text-text-tertiary text-center">
                    暂无未归类对话
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Collapsed state - just show icons */}
      {isCollapsed && (
        <div className="flex-1 flex flex-col items-center py-4 space-y-2">
          <button
            className="p-2 text-text-secondary hover:bg-sidebar-hover hover:text-text-primary rounded-lg transition-colors"
            title="项目"
          >
            <FolderOpen size={20} />
          </button>
          <button
            className="p-2 text-text-secondary hover:bg-sidebar-hover hover:text-text-primary rounded-lg transition-colors"
            title="聊天记录"
          >
            <MessageCircle size={20} />
          </button>
          <button
            onClick={() => onOpenSkillLibrary?.()}
            className="p-2 text-text-secondary hover:bg-sidebar-hover hover:text-text-primary rounded-lg transition-colors"
            title="技能库"
          >
            <BookOpen size={20} />
          </button>
        </div>
      )}

      {/* User section */}
      <div className="mt-auto border-t border-platinum-400 p-2">
        <div className="relative">
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className={clsx(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors',
              'text-text-secondary hover:bg-sidebar-hover hover:text-text-primary'
            )}
          >
            <div className="w-8 h-8 bg-gradient-to-br from-rosegold-300 to-rosegold-500 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm">
              <User size={16} className="text-white" />
            </div>
            {!isCollapsed && (
              <>
                <div className="flex-1 text-left">
                  <div className="text-sm font-medium text-text-primary">{isGuest ? '游客' : (user?.username || '用户')}</div>
                  <div className="text-xs text-text-muted">{isGuest ? '' : (user?.email || '')}</div>
                </div>
                <ChevronDown size={16} className={clsx(
                  'transition-transform',
                  isUserMenuOpen && 'rotate-180'
                )} />
              </>
            )}
          </button>

          {/* User dropdown menu */}
          {isUserMenuOpen && (
            <div className={clsx(
              'absolute bottom-full mb-2 bg-white rounded-xl shadow-luxury-lg border border-platinum-400 py-1.5 z-50',
              isCollapsed ? 'left-full ml-2 w-48' : 'left-0 right-0'
            )}>
              <button className="w-full flex items-center gap-3 px-4 py-2.5 text-text-secondary hover:bg-platinum-200 hover:text-text-primary transition-colors">
                <Settings size={18} />
                <span className="text-sm">设置</span>
              </button>
              <button className="w-full flex items-center gap-3 px-4 py-2.5 text-text-secondary hover:bg-platinum-200 hover:text-text-primary transition-colors">
                <HelpCircle size={18} />
                <span className="text-sm">帮助</span>
              </button>
              <div className="h-px bg-platinum-400 my-1" />
              {isGuest ? (
                <button 
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    navigate('/login');
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-accent-primary hover:bg-platinum-200 transition-colors"
                >
                  <LogOut size={18} />
                  <span className="text-sm">登录</span>
                </button>
              ) : (
                <button 
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-rose-400 hover:bg-rose-50 transition-colors"
                >
                  <LogOut size={18} />
                  <span className="text-sm">退出登录</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
