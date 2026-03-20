import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * 文件树节点类型（来自后端 GET /api/files/tree）
 */
export interface FileTreeNodeData {
  name: string;
  type: 'file' | 'dir';
  path: string;
  size?: number;
  modified?: number;
}

interface FileTreeNodeProps {
  node: FileTreeNodeData;
  level: number;
  fetchChildren: (path: string) => Promise<FileTreeNodeData[]>;
  autoExpandPath?: string;
  refreshToken?: number;
  onDownload?: (path: string) => void;
  onDelete?: (path: string, name: string) => void;
  onMove?: (srcPath: string, destDir: string) => void;
  onSelect?: (path: string, name: string) => void;
}

/** 格式化文件大小 */
function formatSize(bytes?: number): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** 根据文件扩展名返回 icon */
function getFileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const iconMap: Record<string, string> = {
    py: '🐍', r: '📊', rmd: '📊',
    csv: '📋', tsv: '📋', xlsx: '📋', xls: '📋',
    txt: '📄', md: '📄', log: '📄',
    json: '⚙️', yaml: '⚙️', yml: '⚙️', toml: '⚙️',
    sh: '⚡', bash: '⚡',
    fa: '🧬', fasta: '🧬', fastq: '🧬', fq: '🧬',
    bam: '🧬', sam: '🧬', vcf: '🧬', bed: '🧬', gtf: '🧬', gff: '🧬',
    png: '🖼️', jpg: '🖼️', jpeg: '🖼️', svg: '🖼️', pdf: '📑',
    gz: '📦', tar: '📦', zip: '📦', bz2: '📦',
    html: '🌐',
  };
  return iconMap[ext] || '📄';
}


function FileTreeNode({ node, level, fetchChildren, autoExpandPath, refreshToken, onDownload, onDelete, onMove, onSelect }: FileTreeNodeProps) {
  const [expanded, setExpanded] = useState(node.type === 'dir');
  const [children, setChildren] = useState<FileTreeNodeData[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const dragCountRef = useRef(0);
  const prevRefreshRef = useRef(refreshToken);

  // 自动展开：如果当前节点是 autoExpandPath 的前缀
  useEffect(() => {
    if (
      node.type === 'dir' &&
      autoExpandPath &&
      (autoExpandPath === node.path || autoExpandPath.startsWith(node.path + '/'))
    ) {
      if (!expanded) {
        setExpanded(true);
      }
    }
  }, [autoExpandPath, node.path, node.type]);

  // refreshToken 变化时，已展开的节点重新拉取子节点
  useEffect(() => {
    if (prevRefreshRef.current !== refreshToken && expanded) {
      prevRefreshRef.current = refreshToken;
      setChildren(null); // 触发下面的 effect 重新加载
    } else {
      prevRefreshRef.current = refreshToken;
    }
  }, [refreshToken, expanded]);

  // 展开时获取子节点
  useEffect(() => {
    if (expanded && children === null && !loading) {
      setLoading(true);
      fetchChildren(node.path)
        .then(setChildren)
        .catch(() => setChildren([]))
        .finally(() => setLoading(false));
    }
  }, [expanded, children, loading, fetchChildren, node.path]);

  const toggleExpand = useCallback(() => {
    if (node.type === 'dir') {
      setExpanded(prev => !prev);
    } else if (onSelect) {
      onSelect(node.path, node.name);
    }
  }, [node.type, node.path, node.name, onSelect]);

  // ---- Drag & Drop ----
  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData('application/x-filetree-path', node.path);
    e.dataTransfer.effectAllowed = 'move';
  }, [node.path]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (node.type !== 'dir') return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, [node.type]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (node.type !== 'dir') return;
    e.preventDefault();
    dragCountRef.current += 1;
    setDragOver(true);
  }, [node.type]);

  const handleDragLeave = useCallback(() => {
    if (node.type !== 'dir') return;
    dragCountRef.current -= 1;
    if (dragCountRef.current <= 0) {
      dragCountRef.current = 0;
      setDragOver(false);
    }
  }, [node.type]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCountRef.current = 0;
    setDragOver(false);
    if (node.type !== 'dir' || !onMove) return;
    const srcPath = e.dataTransfer.getData('application/x-filetree-path');
    if (!srcPath || srcPath === node.path) return;
    // 不能拖到自身子目录
    if (node.path.startsWith(srcPath + '/')) return;
    // 不能拖到同一个父目录（位置不变）
    const srcParent = srcPath.includes('/') ? srcPath.substring(0, srcPath.lastIndexOf('/')) : '';
    if (srcParent === node.path) return;
    onMove(srcPath, node.path);
  }, [node.type, node.path, onMove]);

  const paddingLeft = 12 + level * 16;

  return (
    <div>
      <div
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex items-center py-1 px-2 cursor-pointer hover:bg-platinum-300 rounded transition-colors duration-150 group
          ${dragOver ? 'bg-blue-100 ring-1 ring-blue-400' : ''}`}
        style={{ paddingLeft }}
        onClick={toggleExpand}
      >
        {/* 展开/折叠图标 */}
        {node.type === 'dir' ? (
          <span className="w-4 h-4 flex items-center justify-center mr-1 text-text-muted text-xs transition-transform duration-150"
            style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
          >
            ▶
          </span>
        ) : (
          <span className="w-4 h-4 mr-1" />
        )}

        {/* 图标 */}
        <span className="mr-1.5 text-sm">
          {node.type === 'dir' ? (expanded ? '📂' : '📁') : getFileIcon(node.name)}
        </span>

        {/* 文件名 */}
        <span className="text-sm text-text-primary truncate flex-1">{node.name}</span>

        {/* 操作按钮（hover 时显示） */}
        <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1 flex-shrink-0">
          {node.type === 'file' && onSelect && (
            <button
              onClick={(e) => { e.stopPropagation(); onSelect(node.path, node.name); }}
              className="p-0.5 rounded hover:bg-emerald-100 text-text-muted hover:text-emerald-500 transition-colors"
              title="引用到聊天"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </button>
          )}
          {node.type === 'file' && onDownload && (
            <button
              onClick={(e) => { e.stopPropagation(); onDownload(node.path); }}
              className="p-0.5 rounded hover:bg-blue-100 text-text-muted hover:text-blue-500 transition-colors"
              title="下载"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(node.path, node.name); }}
              className="p-0.5 rounded hover:bg-red-100 text-text-muted hover:text-red-500 transition-colors"
              title="删除"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          )}
        </span>

        {/* 文件大小 */}
        {node.type === 'file' && node.size != null && (
          <span className="text-xs text-text-muted ml-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            {formatSize(node.size)}
          </span>
        )}
      </div>

      {/* 子节点 */}
      {expanded && node.type === 'dir' && (
        <div>
          {loading && (
            <div className="text-xs text-text-muted py-1" style={{ paddingLeft: paddingLeft + 20 }}>
              加载中...
            </div>
          )}
          {children?.map(child => (
            <FileTreeNode
              key={child.path}
              node={child}
              level={level + 1}
              fetchChildren={fetchChildren}
              autoExpandPath={autoExpandPath}
              refreshToken={refreshToken}
              onDownload={onDownload}
              onDelete={onDelete}
              onMove={onMove}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}


interface FileTreeProps {
  fetchChildren: (path: string) => Promise<FileTreeNodeData[]>;
  autoExpandPath?: string;
  refreshToken?: number;
  onDownload?: (path: string) => void;
  onDelete?: (path: string, name: string) => void;
  onMove?: (srcPath: string, destDir: string) => void;
  onSelect?: (path: string, name: string) => void;
}

export default function FileTree({ fetchChildren, autoExpandPath, refreshToken, onDownload, onDelete, onMove, onSelect }: FileTreeProps) {
  const [rootNodes, setRootNodes] = useState<FileTreeNodeData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 加载根目录（初始 + refreshToken 变化时重新拉取，但不重置 loading 以保持展开状态）
  useEffect(() => {
    setLoading(prev => rootNodes.length === 0 ? true : prev);
    setError(null);
    fetchChildren('')
      .then(nodes => {
        setRootNodes(nodes);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message || '加载失败');
        setLoading(false);
      });
  }, [fetchChildren, refreshToken]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-text-muted text-sm">
        <span className="animate-spin mr-2">⏳</span>
        加载文件列表...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-sm">
        <span className="text-red-400 mb-2">❌ {error}</span>
        <button
          className="text-accent-primary hover:text-accent-hover text-xs underline"
          onClick={() => {
            setLoading(true);
            setError(null);
            fetchChildren('').then(setRootNodes).catch(e => setError(e.message)).finally(() => setLoading(false));
          }}
        >
          重试
        </button>
      </div>
    );
  }

  if (rootNodes.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-text-muted text-sm">
        📭 暂无文件
      </div>
    );
  }

  return (
    <div className="py-1">
      {rootNodes.map(node => (
        <FileTreeNode
          key={node.path}
          node={node}
          level={0}
          fetchChildren={fetchChildren}
          autoExpandPath={autoExpandPath}
          refreshToken={refreshToken}
          onDownload={onDownload}
          onDelete={onDelete}
          onMove={onMove}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
