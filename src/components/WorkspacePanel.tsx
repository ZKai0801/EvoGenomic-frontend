import { useState, useCallback, useRef, useEffect } from 'react';
import { StopCircle } from 'lucide-react';
import FileTree from './FileTree';
import PlanPanel from './PlanPanel';
import FilePreviewModal from './FilePreviewModal';
import type { FileTreeNodeData } from './FileTree';
import type { PlanData } from '@/types';
import { chatApiClient } from '@/api';
import { useAuth } from './AuthGuard';

type TabId = 'files' | 'plan' | 'env';

interface Tab {
  id: TabId;
  label: string;
  icon: string;
}

const TABS: Tab[] = [
  { id: 'files', label: '文件', icon: '📁' },
  { id: 'plan', label: '规划', icon: '📋' },
  { id: 'env', label: '环境', icon: '⚙️' },
];

interface WorkspacePanelProps {
  isOpen: boolean;
  onToggle: () => void;
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  currentProjectId?: string;
  planData?: PlanData | null;
  isPlanEditable?: boolean;
  isPlanExecuting?: boolean;
  onPlanConfirm?: (plan: PlanData) => void;
  onPlanExit?: () => void;
  onPlanExecute?: (stepIds?: number[]) => void;
  onCancelExecution?: () => void;
  onFileSelect?: (path: string, name: string) => void;
  dbConversationId?: number | null;
  sessionId?: string;
}

/** 允许上传的文件后缀 */
const ALLOWED_EXTENSIONS = ['.csv', '.xlsx', '.xls', '.tsv', '.txt', '.fasta', '.fa', '.fq', '.fastq', '.gz', '.bam', '.vcf', '.bed', '.gff', '.gtf'];

export default function WorkspacePanel({
  isOpen,
  onToggle,
  activeTab,
  onTabChange,
  currentProjectId,
  planData,
  isPlanEditable = false,
  isPlanExecuting = false,
  onPlanConfirm,
  onPlanExit,
  onPlanExecute,
  onCancelExecution,
  onFileSelect,
  dbConversationId,
  sessionId,
}: WorkspacePanelProps) {
  const { isGuest } = useAuth();
  const [fileTreeKey, setFileTreeKey] = useState(0);
  const [panelWidth, setPanelWidth] = useState(288);
  const [isResizing, setIsResizing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewFile, setPreviewFile] = useState<{ path: string; name: string } | null>(null);
  const resizeStartXRef = useRef(0);
  const resizeStartWidthRef = useRef(288);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const minWidth = 260;
  const maxWidth = 560;

  // 文件树懒加载回调
  const fetchChildren = useCallback(async (path: string): Promise<FileTreeNodeData[]> => {
    if (isGuest) return [];
    return chatApiClient.getFileTree(path || undefined);
  }, [isGuest]);

  // 下载文件
  const handleDownload = useCallback(async (path: string) => {
    try {
      await chatApiClient.downloadFile(path);
    } catch (err) {
      alert(err instanceof Error ? err.message : '下载失败');
    }
  }, []);

  // 删除文件/目录
  const handleDelete = useCallback(async (path: string, name: string) => {
    if (!window.confirm(`确定删除「${name}」？此操作不可恢复。`)) return;
    try {
      await chatApiClient.deleteFile(path);
      // 刷新文件树
      setFileTreeKey(k => k + 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败');
    }
  }, []);

  // 移动文件/目录（拖拽）
  const handleMove = useCallback(async (srcPath: string, destDir: string) => {
    const fileName = srcPath.split('/').pop() || '';
    const dest = destDir ? `${destDir}/${fileName}` : fileName;
    try {
      await chatApiClient.moveFile(srcPath, dest);
      setFileTreeKey(k => k + 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : '移动失败');
    }
  }, []);

  // 新建文件
  const handleCreateFile = useCallback(async () => {
    const name = window.prompt('请输入文件名：');
    if (!name || !name.trim()) return;
    const safeName = name.trim();
    try {
      await chatApiClient.createFile(safeName);
      setFileTreeKey(k => k + 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : '创建文件失败');
    }
  }, []);

  // 新建文件夹
  const handleCreateDir = useCallback(async () => {
    const name = window.prompt('请输入文件夹名：');
    if (!name || !name.trim()) return;
    const safeName = name.trim();
    try {
      await chatApiClient.createDirectory(safeName);
      setFileTreeKey(k => k + 1);
    } catch (err) {
      alert(err instanceof Error ? err.message : '创建文件夹失败');
    }
  }, []);

  // 刷新文件树
  const handleRefresh = useCallback(() => {
    setFileTreeKey(k => k + 1);
  }, []);

  // 上传文件到工作区
  const handleUploadClick = useCallback(() => {
    uploadInputRef.current?.click();
  }, []);

  const handleUploadChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      alert('不支持的文件类型。请上传 CSV、Excel、TSV 或常见生物信息学文件。');
      return;
    }
    if (file.size > 2 * 1024 * 1024 * 1024) {
      alert('文件大小不能超过 2GB');
      return;
    }

    setIsUploading(true);
    try {
      const projectId = currentProjectId ? Number(currentProjectId) : undefined;
      const result = await chatApiClient.uploadFile(
        file,
        { projectId, conversationId: dbConversationId ?? undefined, sessionId },
      );
      // 刷新文件树
      setFileTreeKey(k => k + 1);
      // 自动添加到聊天引用
      if (onFileSelect) {
        const hostPath = result.file_path;
        const m = hostPath.match(/user_storage\/\d+\/(.+)$/);
        const workspacePath = m ? m[1] : `uploads/${result.filename}`;
        onFileSelect(workspacePath, result.filename);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : '上传失败');
    } finally {
      setIsUploading(false);
      if (uploadInputRef.current) uploadInputRef.current.value = '';
    }
  }, [currentProjectId, dbConversationId, sessionId, onFileSelect]);

  // 文件预览
  const handlePreview = useCallback((path: string, name: string) => {
    setPreviewFile({ path, name });
  }, []);

  const handleResizeStart = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    resizeStartXRef.current = e.clientX;
    resizeStartWidthRef.current = panelWidth;
    setIsResizing(true);
  }, [panelWidth]);

  useEffect(() => {
    if (!isResizing) return;

    const onMouseMove = (e: MouseEvent) => {
      const delta = resizeStartXRef.current - e.clientX;
      const nextWidth = Math.min(maxWidth, Math.max(minWidth, resizeStartWidthRef.current + delta));
      setPanelWidth(nextWidth);
    };

    const onMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isResizing]);

  return (
    <>
      {/* 折叠时的侧边 toggle 按钮 */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="h-full w-8 flex flex-col items-center justify-center
                     bg-sidebar border-l border-platinum-400
                     hover:bg-sidebar-hover transition-colors duration-200
                     text-platinum-600 hover:text-text-secondary"
          title="展开工作区"
        >
          <span className="text-xs mb-1">&lt;</span>
          <span className="text-xs [writing-mode:vertical-lr] tracking-widest">工作区</span>
        </button>
      )}

      {/* 展开的面板 */}
      {isOpen && (
        <div
          className="h-full flex flex-col border-l border-platinum-400 bg-sidebar relative"
          style={{ width: `${panelWidth}px` }}
        >
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="调整工作区宽度"
            onMouseDown={handleResizeStart}
            className="absolute left-0 top-0 h-full w-1.5 -translate-x-1/2 cursor-col-resize z-20"
          >
            <div className="h-full w-px mx-auto bg-transparent hover:bg-platinum-500 transition-colors" />
          </div>

          {/* 头部：标题 + 折叠按钮 */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-platinum-400">
            <span className="text-sm font-medium text-text-primary">工作区</span>
            <button
              onClick={onToggle}
              className="w-6 h-6 flex items-center justify-center rounded
                         hover:bg-platinum-300 text-platinum-600 hover:text-text-secondary
                         transition-colors duration-150"
              title="收起工作区"
            >
              &gt;
            </button>
          </div>

          {/* Tab 栏 */}
          <div className="flex border-b border-platinum-400">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex-1 py-2 text-xs flex items-center justify-center gap-1
                           transition-colors duration-150
                           ${activeTab === tab.id
                    ? 'text-accent-primary border-b-2 border-accent-primary bg-white'
                    : 'text-text-muted hover:text-text-secondary hover:bg-platinum-300'
                  }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab 内容区 */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === 'files' && (
              <div className="flex flex-col h-full">
                {/* 文件操作工具栏 */}
                <div className="flex items-center gap-1 px-2 py-1.5 border-b border-platinum-300">
                  <button
                    onClick={handleCreateFile}
                    className="p-1 rounded hover:bg-platinum-300 text-text-muted hover:text-text-primary transition-colors"
                    title="新建文件"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
                    </svg>
                  </button>
                  <button
                    onClick={handleCreateDir}
                    className="p-1 rounded hover:bg-platinum-300 text-text-muted hover:text-text-primary transition-colors"
                    title="新建文件夹"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>
                    </svg>
                  </button>
                  <button
                    onClick={handleRefresh}
                    className="p-1 rounded hover:bg-platinum-300 text-text-muted hover:text-text-primary transition-colors"
                    title="刷新文件浏览器"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                    </svg>
                  </button>
                  <div className="w-px h-4 bg-platinum-400 mx-0.5" />
                  <button
                    onClick={handleUploadClick}
                    disabled={isUploading}
                    className="p-1 rounded hover:bg-emerald-100 text-text-muted hover:text-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="上传数据文件"
                  >
                    {isUploading ? (
                      <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                    )}
                  </button>
                  <input
                    ref={uploadInputRef}
                    type="file"
                    accept=".csv,.xlsx,.xls,.tsv,.txt,.fasta,.fa,.fq,.fastq,.gz,.bam,.vcf,.bed,.gff,.gtf"
                    onChange={handleUploadChange}
                    className="hidden"
                  />
                </div>
                {/* 文件树 */}
                <div className="flex-1 overflow-y-auto">
                  <FileTree
                    fetchChildren={fetchChildren}
                    autoExpandPath={currentProjectId}
                    refreshToken={fileTreeKey}
                    onDownload={handleDownload}
                    onDelete={handleDelete}
                    onMove={handleMove}
                    onSelect={onFileSelect}
                    onPreview={handlePreview}
                  />
                </div>
              </div>
            )}

            {activeTab === 'plan' && (
              planData ? (
                <div className="flex flex-col h-full">
                  <div className="flex-1 overflow-y-auto">
                    <PlanPanel
                      planData={planData}
                      isEditable={isPlanEditable}
                      isExecuting={isPlanExecuting}
                      onConfirm={onPlanConfirm ?? (() => {})}
                      onExit={onPlanExit ?? (() => {})}
                      onExecute={onPlanExecute}
                    />
                  </div>
                  {isPlanExecuting && onCancelExecution && (
                    <div className="border-t border-platinum-400 p-3">
                      <button
                        onClick={onCancelExecution}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors text-sm font-medium"
                      >
                        <StopCircle className="w-4 h-4" />
                        中断执行
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-text-muted text-sm py-12">
                  <span className="text-2xl mb-3">📋</span>
                  <span>暂无执行计划</span>
                </div>
              )
            )}

            {activeTab === 'env' && (
              <div className="flex flex-col items-center justify-center h-full text-text-muted text-sm py-12">
                <span className="text-2xl mb-3">⚙️</span>
                <span>环境信息开发中</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 文件预览弹窗 */}
      {previewFile && (
        <FilePreviewModal
          isOpen={true}
          filePath={previewFile.path}
          fileName={previewFile.name}
          onClose={() => setPreviewFile(null)}
          onDownload={handleDownload}
        />
      )}
    </>
  );
}
