/**
 * SkillLibrary — 技能库主页面
 *
 * 三个选项卡：流程 (Domains) / 模块 (Modules) / 我的技能 (Custom)
 * 卡片网格展示，点击进入文档查看 / 编辑。
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Search,
  BookOpen,
  Puzzle,
  UserPen,
  Plus,
  Loader2,
} from 'lucide-react';
import clsx from 'clsx';
import { chatApiClient } from '@/api';
import type { SkillInfo } from '@/api/types';
import SkillDocViewer from './SkillDocViewer';
import SkillEditor from './SkillEditor';

type Tab = 'domain' | 'module' | 'user';

interface SkillLibraryProps {
  isAdmin: boolean;
  isGuest: boolean;
}

export default function SkillLibrary({ isAdmin, isGuest }: SkillLibraryProps) {
  const [activeTab, setActiveTab] = useState<Tab>('domain');
  const [domains, setDomains] = useState<SkillInfo[]>([]);
  const [modules, setModules] = useState<SkillInfo[]>([]);
  const [userSkills, setUserSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  // 文档查看
  const [viewingDoc, setViewingDoc] = useState<{ type: 'domain' | 'module' | 'user'; name: string } | null>(null);
  // 编辑器
  const [editing, setEditing] = useState<{
    mode: 'create' | 'edit-user' | 'edit-admin';
    type?: 'domain' | 'module' | 'user';
    name?: string;
  } | null>(null);

  // 加载内置列表
  useEffect(() => {
    setLoading(true);
    Promise.all([
      chatApiClient.listSkillDomains().catch(() => []),
      chatApiClient.listSkillModules().catch(() => []),
    ]).then(([d, m]) => {
      setDomains(d);
      setModules(m);
    }).finally(() => setLoading(false));
  }, []);

  // 加载用户自定义技能
  useEffect(() => {
    if (isGuest) return;
    chatApiClient.listUserSkills().catch(() => []).then(setUserSkills);
  }, [isGuest]);

  const refreshUserSkills = () => {
    chatApiClient.listUserSkills().catch(() => []).then(setUserSkills);
  };

  // 筛选
  const filtered = useMemo(() => {
    const list = activeTab === 'domain' ? domains : activeTab === 'module' ? modules : userSkills;
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(
      (s) => s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q),
    );
  }, [activeTab, domains, modules, userSkills, search]);

  // ── 如果正在查看文档或编辑 ──
  if (viewingDoc) {
    return (
      <SkillDocViewer
        docType={viewingDoc.type}
        docName={viewingDoc.name}
        isAdmin={isAdmin}
        onBack={() => setViewingDoc(null)}
        onEdit={(type, name) => {
          setViewingDoc(null);
          setEditing({
            mode: type === 'user' ? 'edit-user' : 'edit-admin',
            type,
            name,
          });
        }}
        onNavigate={(type, name) => setViewingDoc({ type, name })}
      />
    );
  }

  if (editing) {
    return (
      <SkillEditor
        mode={editing.mode}
        type={editing.type}
        name={editing.name}
        onBack={() => {
          setEditing(null);
          refreshUserSkills();
        }}
        onSaved={(type: string, name: string) => {
          setEditing(null);
          refreshUserSkills();
          // 跳转到刚保存的文档
          setViewingDoc({ type: type as 'domain' | 'module' | 'user', name });
        }}
      />
    );
  }

  // ── 主列表视图 ──
  const tabs: { id: Tab; label: string; icon: typeof BookOpen }[] = [
    { id: 'domain', label: '流程', icon: BookOpen },
    { id: 'module', label: '模块', icon: Puzzle },
    { id: 'user', label: '我的技能', icon: UserPen },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-cream-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-platinum-400">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center shadow-sm">
            <BookOpen size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-text-primary">技能库</h1>
            <p className="text-xs text-text-muted">
              {domains.length} 个流程 · {modules.length} 个模块
              {!isGuest && ` · ${userSkills.length} 个自定义技能`}
            </p>
          </div>
        </div>

        {/* 新建技能 */}
        {!isGuest && (
          <button
            onClick={() => setEditing({ mode: 'create' })}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg transition-colors text-sm font-medium shadow-sm"
          >
            <Plus size={16} />
            新建技能
          </button>
        )}
      </div>

      {/* Tabs + Search */}
      <div className="flex items-center gap-4 px-6 py-3 border-b border-platinum-300">
        <div className="flex gap-1 bg-platinum-200 rounded-lg p-0.5">
          {tabs.map((tab) => {
            if (tab.id === 'user' && isGuest) return null;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  'flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-all',
                  activeTab === tab.id
                    ? 'bg-white text-text-primary shadow-sm'
                    : 'text-text-secondary hover:text-text-primary',
                )}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索技能名称或描述…"
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-platinum-400 rounded-lg text-sm focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
          />
        </div>
      </div>

      {/* Card Grid */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-text-muted">
            <Loader2 size={24} className="animate-spin mr-2" />
            加载中…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-text-muted">
            <BookOpen size={32} className="mb-2 opacity-50" />
            <span className="text-sm">{search ? '没有匹配的技能' : '暂无内容'}</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((skill) => (
              <button
                key={`${skill.type}-${skill.name}`}
                onClick={() =>
                  setViewingDoc({ type: skill.type as 'domain' | 'module' | 'user', name: skill.name })
                }
                className="group text-left p-4 bg-white border border-platinum-300 rounded-xl hover:border-emerald-400 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={clsx(
                      'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
                      skill.type === 'domain'
                        ? 'bg-emerald-100 text-emerald-600'
                        : skill.type === 'module'
                          ? 'bg-blue-100 text-blue-600'
                          : 'bg-purple-100 text-purple-600',
                    )}
                  >
                    {skill.type === 'domain' ? (
                      <BookOpen size={16} />
                    ) : skill.type === 'module' ? (
                      <Puzzle size={16} />
                    ) : (
                      <UserPen size={16} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-text-primary group-hover:text-emerald-600 transition-colors truncate">
                      {skill.name}
                    </div>
                    <p className="text-xs text-text-muted mt-1 line-clamp-3 leading-relaxed">
                      {skill.description || '暂无描述'}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
