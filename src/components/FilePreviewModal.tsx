/**
 * FilePreviewModal - 文件预览弹窗
 *
 * 支持预览：
 * - 纯文本文件（.txt, .csv, .tsv, .log, .fa, .fasta, .vcf, .bed, .sam 等）
 * - 代码文件（.py, .r, .sh, .json, .yaml, .js, .ts 等）→ 语法高亮
 * - Markdown 文件（.md）→ 渲染后的 Markdown
 * - HTML 文件（.html）→ 沙盒 iframe 渲染
 * - 图片文件（.png, .jpg, .jpeg, .gif, .bmp, .webp, .svg）→ 图片显示
 * - 二进制 / 过大文件 → 提示无法预览
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Download, Maximize2, Minimize2 } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';
import AsyncCodeBlockRenderer from './AsyncCodeBlockRenderer';
import { chatApiClient } from '@/api';

interface FilePreviewModalProps {
  isOpen: boolean;
  filePath: string;
  fileName: string;
  onClose: () => void;
  onDownload?: (path: string) => void;
}

/** 可以文本预览的扩展名 → 语法高亮语言映射 */
const CODE_LANG_MAP: Record<string, string> = {
  py: 'python', r: 'r', rmd: 'r',
  sh: 'bash', bash: 'bash',
  json: 'json',
  yaml: 'yaml', yml: 'yaml',
  sql: 'sql',
  js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
  css: 'css', xml: 'xml',
  toml: 'toml', ini: 'ini', cfg: 'ini', conf: 'ini',
  diff: 'diff', patch: 'diff',
};

/** 纯文本扩展名（无语法高亮，用 <pre> 显示） */
const PLAIN_TEXT_EXTS = new Set([
  'txt', 'csv', 'tsv', 'log', 'env',
  'fa', 'fasta', 'fq', 'fastq',
  'vcf', 'bed', 'gtf', 'gff', 'sam',
]);

/** 图片扩展名 */
const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg']);

/** 已知二进制扩展名（直接报错，不尝试解码） */
const BINARY_EXTS = new Set([
  'gz', 'tar', 'zip', 'bz2', 'xz', '7z', 'rar',
  'bam', 'bai', 'cram', 'crai',
  'pdf', 'doc', 'docx', 'ppt', 'pptx',
  'xlsx', 'xls',
  'exe', 'so', 'dll', 'o', 'a',
  'mp3', 'mp4', 'avi', 'mov', 'wav',
]);

/** 获取文件扩展名（小写） */
function getExt(name: string): string {
  return name.split('.').pop()?.toLowerCase() || '';
}

type PreviewMode = 'text' | 'code' | 'markdown' | 'html' | 'image' | 'error';

function detectMode(fileName: string): PreviewMode {
  const ext = getExt(fileName);
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (ext === 'md') return 'markdown';
  if (ext === 'html' || ext === 'htm') return 'html';
  if (CODE_LANG_MAP[ext]) return 'code';
  if (PLAIN_TEXT_EXTS.has(ext)) return 'text';
  if (BINARY_EXTS.has(ext)) return 'error';
  // 未知扩展名 → 尝试文本加载，失败则报错
  return 'text';
}

/** 根据文件扩展名返回 icon（与 FileTree 保持一致） */
function getFileIcon(name: string): string {
  const ext = getExt(name);
  const iconMap: Record<string, string> = {
    py: '🐍', r: '📊', rmd: '📊',
    csv: '📋', tsv: '📋', xlsx: '📋', xls: '📋',
    txt: '📄', md: '📄', log: '📄',
    json: '⚙️', yaml: '⚙️', yml: '⚙️', toml: '⚙️',
    sh: '⚡', bash: '⚡',
    fa: '🧬', fasta: '🧬', fastq: '🧬', fq: '🧬',
    bam: '🧬', sam: '🧬', vcf: '🧬', bed: '🧬', gtf: '🧬', gff: '🧬',
    png: '🖼️', jpg: '🖼️', jpeg: '🖼️', svg: '🖼️', gif: '🖼️', webp: '🖼️', bmp: '🖼️',
    pdf: '📑',
    gz: '📦', tar: '📦', zip: '📦', bz2: '📦',
    html: '🌐',
  };
  return iconMap[ext] || '📄';
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function FilePreviewModal({
  isOpen,
  filePath,
  fileName,
  onClose,
  onDownload,
}: FilePreviewModalProps) {
  const [content, setContent] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [fileSize, setFileSize] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const prevPathRef = useRef('');

  const mode = detectMode(fileName);
  const ext = getExt(fileName);

  // 加载文件内容
  useEffect(() => {
    if (!isOpen || !filePath) return;
    // 避免重复加载同一文件
    if (prevPathRef.current === filePath) return;
    prevPathRef.current = filePath;

    setContent('');
    setImageUrl('');
    setFileSize(0);
    setError('');
    setLoading(true);

    if (mode === 'error') {
      setError(`该文件为二进制格式（.${ext}），无法以文本方式预览`);
      setLoading(false);
      return;
    }

    if (mode === 'image') {
      // 图片：获取 blob → 生成 object URL
      chatApiClient
        .fetchFileBlob(filePath)
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          setImageUrl(url);
          setFileSize(blob.size);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : '加载图片失败');
        })
        .finally(() => setLoading(false));
      return;
    }

    // 文本类文件
    chatApiClient
      .fetchFileContent(filePath)
      .then(({ content: text, size }) => {
        setContent(text);
        setFileSize(size);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : '加载文件失败';
        // 如果是未知扩展名尝试文本解码失败
        if (msg.includes('文件过大')) {
          setError(msg);
        } else {
          setError(`无法预览该文件：${msg}`);
        }
      })
      .finally(() => setLoading(false));
  }, [isOpen, filePath, mode, ext]);

  // 关闭时清理
  useEffect(() => {
    if (!isOpen) {
      prevPathRef.current = '';
      // 清理 object URL
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
        setImageUrl('');
      }
    }
  }, [isOpen]);

  // Escape 键关闭
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev);
  }, []);

  if (!isOpen) return null;

  const codeLang = CODE_LANG_MAP[ext];

  // 容器尺寸：普通 vs 全屏
  const containerClass = isFullscreen
    ? 'fixed inset-4 z-[60] flex flex-col'
    : 'relative max-w-4xl w-full max-h-[85vh] mx-4 flex flex-col';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩层 */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 弹窗内容 */}
      <div
        className={`${containerClass} bg-white border border-platinum-400 rounded-xl shadow-2xl overflow-hidden`}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-platinum-300 bg-platinum-100 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-base flex-shrink-0">{getFileIcon(fileName)}</span>
            <span className="text-sm font-medium text-text-primary truncate">
              {fileName}
            </span>
            {fileSize > 0 && (
              <span className="text-xs text-text-muted flex-shrink-0">
                ({formatSize(fileSize)})
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {onDownload && (
              <button
                onClick={() => onDownload(filePath)}
                className="p-1.5 rounded hover:bg-platinum-300 text-text-muted hover:text-blue-500 transition-colors"
                title="下载文件"
              >
                <Download size={16} />
              </button>
            )}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded hover:bg-platinum-300 text-text-muted hover:text-text-primary transition-colors"
              title={isFullscreen ? '退出全屏' : '全屏预览'}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-platinum-300 text-text-muted hover:text-red-500 transition-colors"
              title="关闭"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* 内容区 */}
        <div className="flex-1 overflow-auto">
          {loading && (
            <div className="flex items-center justify-center py-16 text-text-muted text-sm">
              <span className="animate-spin mr-2">⏳</span>
              加载中...
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center py-16 text-sm">
              <span className="text-4xl mb-4">🚫</span>
              <span className="text-red-500 text-center px-8">{error}</span>
            </div>
          )}

          {!loading && !error && mode === 'image' && imageUrl && (
            <div className="flex items-center justify-center p-4 bg-[#f5f5f5] min-h-[200px]">
              <img
                src={imageUrl}
                alt={fileName}
                className="max-w-full max-h-[calc(85vh-60px)] object-contain rounded"
                style={isFullscreen ? { maxHeight: 'calc(100vh - 120px)' } : undefined}
              />
            </div>
          )}

          {!loading && !error && mode === 'markdown' && content && (
            <div className="p-6">
              <MarkdownRenderer content={content} />
            </div>
          )}

          {!loading && !error && mode === 'html' && content && (
            <iframe
              srcDoc={content}
              sandbox=""
              className="w-full border-0"
              style={{ height: isFullscreen ? 'calc(100vh - 120px)' : '70vh' }}
              title={`预览 ${fileName}`}
            />
          )}

          {!loading && !error && mode === 'code' && content && (
            <div className="text-sm">
              <AsyncCodeBlockRenderer language={codeLang}>
                {content}
              </AsyncCodeBlockRenderer>
            </div>
          )}

          {!loading && !error && mode === 'text' && content && (
            <pre className="p-4 text-sm text-text-primary font-mono whitespace-pre overflow-x-auto leading-relaxed">
              {content}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
