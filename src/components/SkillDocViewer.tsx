/**
 * SkillDocViewer — 技能文档查看器
 *
 * 使用 MarkdownRenderer 渲染文档内容，
 * 将 <reference>modules/xxx.md</reference> 标签转换为可点击链接。
 * 管理员可以编辑内置文档。
 */

import { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Edit3,
  BookOpen,
  Puzzle,
  UserPen,
  Loader2,
  Trash2,
} from 'lucide-react';
import clsx from 'clsx';
import { chatApiClient } from '@/api';
import MarkdownRenderer from './MarkdownRenderer';

interface SkillDocViewerProps {
  docType: 'domain' | 'module' | 'user';
  docName: string;
  isAdmin: boolean;
  onBack: () => void;
  onEdit: (type: 'domain' | 'module' | 'user', name: string) => void;
  onNavigate: (type: 'domain' | 'module' | 'user', name: string) => void;
}

export default function SkillDocViewer({
  docType,
  docName,
  isAdmin,
  onBack,
  onEdit,
  onNavigate,
}: SkillDocViewerProps) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError('');
    const fetcher =
      docType === 'user'
        ? chatApiClient.getUserSkillDoc(docName)
        : chatApiClient.getSkillDoc(docType, docName);
    fetcher
      .then((res: { content: string }) => setContent(res.content))
      .catch((e: Error) => setError(e.message || '加载失败'))
      .finally(() => setLoading(false));
  }, [docType, docName]);

  // 删除用户自定义技能
  const handleDelete = async () => {
    if (!confirm(`确定要删除自定义技能「${docName}」吗？`)) return;
    setDeleting(true);
    try {
      await chatApiClient.deleteUserSkill(docName);
      onBack();
    } catch (e: any) {
      alert(e.message || '删除失败');
    } finally {
      setDeleting(false);
    }
  };

  /**
   * 处理 <reference>modules/xxx.md</reference> 标签，
   * 转换为 [🔗 xxx](# ) 格式的可点击链接（通过自定义渲染处理）。
   *
   * 同时在 Markdown 中通过 onClick 拦截这些链接跳转到对应模块。
   */
  const processedContent = useMemo(() => {
    if (!content) return '';

    // 去掉 YAML frontmatter
    let text = content;
    if (text.startsWith('---')) {
      const end = text.indexOf('---', 3);
      if (end !== -1) {
        text = text.slice(end + 3).trimStart();
      }
    }

    // 将 <reference>modules/xxx.md</reference> 转为 markdown 链接
    // 使用特殊的 "#skill-ref:" scheme 以便点击拦截
    text = text.replace(
      /<reference>(modules\/([^<]+?)\.md)<\/reference>/g,
      (_match, _fullPath, moduleName) =>
        `> 📎 参考模块: [${moduleName}](#skill-ref:module:${moduleName})\n`,
    );

    // <reference>domains/xxx.md</reference> (少见但也处理)
    text = text.replace(
      /<reference>(domains\/([^<]+?)\.md)<\/reference>/g,
      (_match, _fullPath, domainName) =>
        `> 📎 参考流程: [${domainName}](#skill-ref:domain:${domainName})\n`,
    );

    // 去掉 <require>...</require> 块（面向 LLM 的参数，不展示给用户看）
    text = text.replace(/<require>[\s\S]*?<\/require>/g, '');

    return text;
  }, [content]);

  // 拦截 <a> 标签点击，处理 #skill-ref: 链接
  const handleContentClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.tagName !== 'A') return;
    const href = target.getAttribute('href') || '';
    if (!href.startsWith('#skill-ref:')) return;
    e.preventDefault();
    // 解析 "#skill-ref:module:xxx" 或 "#skill-ref:domain:xxx"
    const parts = href.slice('#skill-ref:'.length).split(':');
    if (parts.length === 2) {
      onNavigate(parts[0] as 'domain' | 'module', parts[1]);
    }
  };

  const typeLabel = docType === 'domain' ? '流程' : docType === 'module' ? '模块' : '自定义技能';
  const TypeIcon = docType === 'domain' ? BookOpen : docType === 'module' ? Puzzle : UserPen;
  const typeColor =
    docType === 'domain'
      ? 'text-emerald-600 bg-emerald-100'
      : docType === 'module'
        ? 'text-blue-600 bg-blue-100'
        : 'text-purple-600 bg-purple-100';

  return (
    <div className="flex-1 flex flex-col h-full bg-cream-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-platinum-400 bg-white">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 hover:bg-platinum-200 rounded-lg transition-colors text-text-secondary"
          >
            <ArrowLeft size={20} />
          </button>
          <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center', typeColor)}>
            <TypeIcon size={16} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-text-primary">{docName}</h2>
            <span className="text-xs text-text-muted">{typeLabel}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 用户自定义技能可以删除 */}
          {docType === 'user' && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 size={14} />
              删除
            </button>
          )}
          {/* 管理员可编辑内置，普通用户可编辑自定义 */}
          {(docType === 'user' || isAdmin) && (
            <button
              onClick={() => onEdit(docType, docName)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors"
            >
              <Edit3 size={14} />
              编辑
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-text-muted">
            <Loader2 size={24} className="animate-spin mr-2" />
            加载中…
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-40 text-red-500 text-sm">{error}</div>
        ) : (
          <div
            className="max-w-4xl mx-auto bg-white rounded-xl border border-platinum-300 p-8 shadow-sm"
            onClick={handleContentClick}
          >
            <MarkdownRenderer content={processedContent} />
          </div>
        )}
      </div>
    </div>
  );
}
