import { useState, useEffect, useRef, useCallback } from 'react';
import { chatApiClient } from '@/api/client';

interface FileItem {
  name: string;
  path: string;  // workspace-relative（如 uploads/panel_info.xlsx）
}

interface FileMentionDropdownProps {
  query: string;                                   // @之后的筛选文本
  onSelect: (path: string, name: string) => void;  // 选中文件
  onClose: () => void;                             // 关闭下拉框
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

export default function FileMentionDropdown({ query, onSelect, onClose }: FileMentionDropdownProps) {
  const [allFiles, setAllFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // 加载文件列表（仅一次）
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    chatApiClient.listAllFiles()
      .then(nodes => {
        if (cancelled) return;
        setAllFiles(nodes.map(n => ({ name: n.name, path: n.path })));
      })
      .catch(() => {
        if (!cancelled) setAllFiles([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  // 按 query 过滤
  const filtered = allFiles.filter(f => {
    if (!query) return true;
    const q = query.toLowerCase();
    return f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q);
  });

  // 重置选中索引
  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  // 滚动选中项到可见区域
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const active = list.children[activeIndex] as HTMLElement | undefined;
    active?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  // 键盘导航（通过全局事件捕获）
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      setActiveIndex(prev => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      setActiveIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      const item = filtered[activeIndex];
      if (item) onSelect(item.path, item.name);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  }, [filtered, activeIndex, onSelect, onClose]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleKeyDown]);

  // 点击外部关闭
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // 定位样式：在 textarea 上方显示
  const style: React.CSSProperties = {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    marginBottom: 4,
    zIndex: 50,
  };

  return (
    <div ref={containerRef} style={style}>
      <div className="bg-white border border-platinum-400 rounded-xl shadow-luxury-md max-h-60 overflow-y-auto" ref={listRef}>
        {loading ? (
          <div className="p-3 text-sm text-text-muted flex items-center gap-2">
            <span className="animate-spin">⏳</span>加载文件列表...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-3 text-sm text-text-muted">无匹配文件</div>
        ) : (
          filtered.slice(0, 50).map((file, idx) => (
            <div
              key={file.path}
              className={`flex items-center gap-2 px-3 py-2 cursor-pointer text-sm transition-colors
                ${idx === activeIndex ? 'bg-rosegold-50 text-rosegold-600' : 'hover:bg-platinum-200 text-text-primary'}`}
              onMouseEnter={() => setActiveIndex(idx)}
              onClick={() => onSelect(file.path, file.name)}
            >
              <span className="flex-shrink-0">{getFileIcon(file.name)}</span>
              <span className="truncate font-medium">{file.name}</span>
              <span className="text-xs text-text-muted truncate ml-auto">{file.path}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
