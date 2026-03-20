import { useState, useRef, useCallback } from 'react';
import { Send, Paperclip, StopCircle, X, FileSpreadsheet } from 'lucide-react';
import { ReferencedFile } from '@/types';
import FileMentionDropdown from './FileMentionDropdown';
import { chatApiClient } from '@/api/client';
import clsx from 'clsx';

/** 允许上传的文件后缀 */
const ALLOWED_EXTENSIONS = ['.csv', '.xlsx', '.xls', '.tsv', '.txt', '.fasta', '.fa', '.fq', '.fastq', '.gz', '.bam', '.vcf', '.bed', '.gff', '.gtf'];

export interface ChatInputProps {
  /** 提交消息（已拼接文件头部信息） */
  onSubmit: (content: string) => void;
  /** 是否正在加载（禁用输入，显示停止按钮） */
  isLoading?: boolean;
  /** 点击停止按钮时触发 */
  onStop?: () => void;
  placeholder?: string;
  /** 外部引用文件列表（受控模式，由 App.tsx 管理） */
  referencedFiles?: ReferencedFile[];
  onAddReferencedFile?: (file: ReferencedFile) => void;
  onRemoveReferencedFile?: (workspacePath: string) => void;
  onClearReferencedFiles?: () => void;
  /** 上传所需的上下文 */
  currentProjectId?: string;
  dbConversationId?: number | null;
  sessionId?: string;
  /** 最大文本框高度（px） */
  maxHeight?: number;
  /** 是否显示底部提示文字 */
  showDisclaimer?: boolean;
}

export default function ChatInput({
  onSubmit,
  isLoading = false,
  onStop,
  placeholder = '输入消息...',
  referencedFiles: externalFiles,
  onAddReferencedFile: externalAdd,
  onRemoveReferencedFile: externalRemove,
  onClearReferencedFiles: externalClear,
  currentProjectId,
  dbConversationId,
  sessionId,
  maxHeight = 200,
  showDisclaimer = false,
}: ChatInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [internalFiles, setInternalFiles] = useState<ReferencedFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 受控 vs 非受控文件列表
  const referencedFiles = externalFiles ?? internalFiles;

  const addReferencedFile = useCallback((file: ReferencedFile) => {
    if (externalAdd) {
      externalAdd(file);
    } else {
      setInternalFiles(prev => {
        if (prev.some(f => f.workspacePath === file.workspacePath)) return prev;
        return [...prev, file];
      });
    }
  }, [externalAdd]);

  const removeReferencedFile = useCallback((workspacePath: string) => {
    if (externalRemove) {
      externalRemove(workspacePath);
    } else {
      setInternalFiles(prev => prev.filter(f => f.workspacePath !== workspacePath));
    }
  }, [externalRemove]);

  const clearReferencedFiles = useCallback(() => {
    if (externalClear) {
      externalClear();
    } else {
      setInternalFiles([]);
    }
  }, [externalClear]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showMentionDropdown) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setInputValue(val);

    // 检测 @ 触发
    const cursorPos = e.target.selectionStart ?? val.length;
    const textBeforeCursor = val.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@([^\s@]*)$/);
    if (atMatch) {
      setShowMentionDropdown(true);
      setMentionQuery(atMatch[1]);
    } else {
      setShowMentionDropdown(false);
      setMentionQuery('');
    }

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, maxHeight)}px`;
    }
  };

  // @mention 选中文件
  const handleMentionSelect = (path: string, name: string) => {
    const cursorPos = textareaRef.current?.selectionStart ?? inputValue.length;
    const textBeforeCursor = inputValue.slice(0, cursorPos);
    const textAfterCursor = inputValue.slice(cursorPos);
    const cleaned = textBeforeCursor.replace(/@[^\s@]*$/, '');
    setInputValue(cleaned + textAfterCursor);
    setShowMentionDropdown(false);
    setMentionQuery('');
    addReferencedFile({ name, workspacePath: path, source: 'workspace' });
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(fileExt)) {
      setUploadError('不支持的文件类型。请上传 CSV、Excel、TSV 或常见生物信息学文件。');
      return;
    }
    if (file.size > 2 * 1024 * 1024 * 1024) {
      setUploadError('文件大小不能超过 2GB');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadProgress(0);

    try {
      const projectId = currentProjectId ? Number(currentProjectId) : undefined;
      const result = await chatApiClient.uploadFile(
        file,
        {
          projectId,
          conversationId: dbConversationId ?? undefined,
          sessionId,
        },
        (percent) => setUploadProgress(percent),
      );
      const hostPath = result.file_path;
      const m = hostPath.match(/user_storage\/\d+\/(.+)$/);
      const workspacePath = m ? m[1] : `uploads/${result.filename}`;
      addReferencedFile({ name: result.filename, workspacePath, source: 'upload' });
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : '上传失败');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    let messageContent = inputValue.trim();

    if (referencedFiles.length > 0) {
      const fileHeaders = referencedFiles.map(f => {
        const label = f.source === 'upload' ? '已上传数据文件' : '引用文件';
        return `[${label}: ${f.name}]\n工作区路径: /workspace/${f.workspacePath}`;
      }).join('\n');

      messageContent = messageContent
        ? `${fileHeaders}\n\n${messageContent}`
        : `${fileHeaders}\n\n请分析这些数据文件。`;

      clearReferencedFiles();
    }

    if (messageContent) {
      onSubmit(messageContent);
      setInputValue('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const canSubmit = inputValue.trim() || referencedFiles.length > 0;

  return (
    <div>
      {/* 引用文件预览 */}
      {referencedFiles.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {referencedFiles.map(f => (
            <div key={f.workspacePath} className="inline-flex max-w-full items-center gap-2 rounded-md border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs text-slate-700">
              <FileSpreadsheet size={14} className="text-slate-500" />
              <span className="truncate">{f.name}</span>
              <button
                onClick={() => removeReferencedFile(f.workspacePath)}
                className="p-0.5 text-slate-400 hover:text-slate-600 transition-colors"
                title="移除"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 上传错误提示 */}
      {uploadError && (
        <div className="mb-3 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-3">
          <p className="text-sm text-rose-600 flex-1">{uploadError}</p>
          <button onClick={() => setUploadError(null)} className="p-1 text-rose-400 hover:text-rose-600">
            <X size={16} />
          </button>
        </div>
      )}

      {/* 上传进度 */}
      {isUploading && (
        <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-blue-600">正在上传文件... {uploadProgress}%</p>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-1.5">
            <div className="bg-blue-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
          </div>
        </div>
      )}

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_EXTENSIONS.join(',')}
        onChange={handleFileChange}
        className="hidden"
      />

      <form onSubmit={handleSubmit}>
        <div className="relative bg-white rounded-2xl border border-platinum-400 focus-within:border-rosegold-300 focus-within:shadow-accent transition-all duration-200 shadow-luxury">
          {/* @mention 下拉框 */}
          {showMentionDropdown && (
            <FileMentionDropdown
              query={mentionQuery}
              onSelect={handleMentionSelect}
              onClose={() => { setShowMentionDropdown(false); setMentionQuery(''); }}
            />
          )}
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="chat-input w-full bg-transparent text-text-primary placeholder-text-muted px-4 py-3 pr-24 focus:outline-none resize-none"
            rows={1}
            disabled={isLoading}
          />
          <div className="absolute right-2 bottom-2 flex items-center gap-1">
            <button
              type="button"
              onClick={handleUploadClick}
              disabled={isUploading}
              className={clsx(
                "p-2 transition-colors rounded-lg",
                isUploading
                  ? "text-text-muted cursor-not-allowed"
                  : "text-text-muted hover:text-rosegold-400 hover:bg-rosegold-50"
              )}
              title="上传数据文件 (CSV, Excel, TSV)"
            >
              {isUploading ? (
                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Paperclip size={20} />
              )}
            </button>
            {isLoading ? (
              <button
                type="button"
                onClick={onStop}
                className="p-2 rounded-lg transition-all duration-200 text-white bg-red-500 hover:bg-red-600 shadow-sm"
                title="停止生成"
              >
                <StopCircle size={20} />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!canSubmit}
                className={clsx(
                  'p-2 rounded-lg transition-all duration-200',
                  canSubmit
                    ? 'text-white bg-gradient-to-br from-rosegold-400 to-rosegold-500 hover:from-rosegold-500 hover:to-rosegold-600 shadow-sm'
                    : 'text-text-muted bg-transparent cursor-not-allowed'
                )}
                title="发送"
              >
                <Send size={20} />
              </button>
            )}
          </div>
        </div>
      </form>
      {showDisclaimer && (
        <p className="text-center text-text-muted text-xs mt-3">
          BioAgent 可能会产生错误。请核实重要信息。
        </p>
      )}
    </div>
  );
}
