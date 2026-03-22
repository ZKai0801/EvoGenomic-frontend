/**
 * SkillEditor — 技能编辑器
 *
 * 左右分栏：左侧 Markdown 编辑区，右侧实时预览。
 * 支持：
 * - 新建用户自定义技能 (mode="create")
 * - 编辑用户自定义技能 (mode="edit-user")
 * - 管理员编辑内置文档 (mode="edit-admin")
 * - 上传 .md 文件填充编辑区
 */

import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Save,
  Upload,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';
import clsx from 'clsx';
import { chatApiClient } from '@/api';
import MarkdownRenderer from './MarkdownRenderer';

interface SkillEditorProps {
  mode: 'create' | 'edit-user' | 'edit-admin';
  type?: 'domain' | 'module' | 'user';
  name?: string;
  onBack: () => void;
  onSaved: (type: string, name: string) => void;
}

const FRONTMATTER_TEMPLATE = `---
name: my_skill
description: "在此输入技能描述"
---

# 技能标题

在此编写技能内容…
`;

export default function SkillEditor({ mode, type, name, onBack, onSaved }: SkillEditorProps) {
  const [skillName, setSkillName] = useState(name || '');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 编辑已有文档时加载内容
  useEffect(() => {
    if (mode === 'create') {
      setContent(FRONTMATTER_TEMPLATE);
      return;
    }
    if (!type || !name) return;
    setLoading(true);
    const fetcher =
      type === 'user'
        ? chatApiClient.getUserSkillDoc(name)
        : chatApiClient.getSkillDoc(type as 'domain' | 'module', name);
    fetcher
      .then((res: { content: string }) => setContent(res.content))
      .catch((e: Error) => alert(e.message || '加载失败'))
      .finally(() => setLoading(false));
  }, [mode, type, name]);

  // 上传 .md 文件
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.md') && !file.name.endsWith('.txt')) {
      alert('请上传 .md 或 .txt 文件');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      setContent(text);
      // 如果名称为空，从文件名提取
      if (!skillName) {
        const baseName = file.name.replace(/\.(md|txt)$/, '').replace(/[^a-zA-Z0-9_\-]/g, '_');
        setSkillName(baseName);
      }
    };
    reader.readAsText(file);
    // 重置 input 以便同一文件可再次选择
    e.target.value = '';
  };

  // 保存
  const handleSave = async () => {
    const trimmedName = skillName.trim();
    if (!trimmedName) {
      alert('请输入技能名称');
      return;
    }
    if (!/^[a-zA-Z0-9_\-]+$/.test(trimmedName)) {
      alert('名称只能包含字母、数字、下划线和短横线');
      return;
    }
    if (!content.trim()) {
      alert('内容不能为空');
      return;
    }

    setSaving(true);
    try {
      if (mode === 'edit-admin' && type && (type === 'domain' || type === 'module')) {
        await chatApiClient.updateAdminDoc(type, trimmedName, content);
      } else {
        // create 或 edit-user
        await chatApiClient.saveUserSkill(trimmedName, content);
      }
      onSaved(mode === 'edit-admin' ? (type || 'domain') : 'user', trimmedName);
    } catch (e: any) {
      alert(e.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const modeLabel =
    mode === 'create' ? '新建技能' : mode === 'edit-user' ? '编辑自定义技能' : '编辑内置文档';

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
          <h2 className="text-base font-semibold text-text-primary">{modeLabel}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-secondary hover:bg-platinum-200 rounded-lg transition-colors"
          >
            {showPreview ? <EyeOff size={14} /> : <Eye size={14} />}
            {showPreview ? '隐藏预览' : '显示预览'}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-text-secondary hover:bg-platinum-200 rounded-lg transition-colors"
          >
            <Upload size={14} />
            上传文件
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md,.txt"
            onChange={handleFileUpload}
            className="hidden"
          />
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white rounded-lg transition-colors text-sm font-medium"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            保存
          </button>
        </div>
      </div>

      {/* Name input (only for create mode) */}
      {mode === 'create' && (
        <div className="px-6 py-3 border-b border-platinum-300 bg-white">
          <label className="text-xs text-text-muted mb-1 block">技能名称（英文标识，不可含空格）</label>
          <input
            type="text"
            value={skillName}
            onChange={(e) => setSkillName(e.target.value)}
            placeholder="例如: my_custom_pipeline"
            className="w-full max-w-md px-3 py-1.5 border border-platinum-400 rounded-lg text-sm focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
          />
        </div>
      )}

      {/* Editor + Preview */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-text-muted">
          <Loader2 size={24} className="animate-spin mr-2" />
          加载中…
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Editor pane */}
          <div className={clsx('flex flex-col border-r border-platinum-300', showPreview ? 'w-1/2' : 'w-full')}>
            <div className="px-4 py-2 border-b border-platinum-200 bg-platinum-100">
              <span className="text-xs font-medium text-text-muted uppercase tracking-wide">Markdown 编辑</span>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="flex-1 p-4 font-mono text-sm bg-white resize-none focus:outline-none leading-relaxed"
              placeholder="在此编写 Markdown 内容…"
              spellCheck={false}
            />
          </div>

          {/* Preview pane */}
          {showPreview && (
            <div className="w-1/2 flex flex-col">
              <div className="px-4 py-2 border-b border-platinum-200 bg-platinum-100">
                <span className="text-xs font-medium text-text-muted uppercase tracking-wide">预览</span>
              </div>
              <div className="flex-1 overflow-y-auto p-6 bg-white">
                <MarkdownRenderer content={content} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
