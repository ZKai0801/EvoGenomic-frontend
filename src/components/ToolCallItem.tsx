import { useState } from 'react';
import {
  FileText, FilePlus2, FileSearch, Replace, Terminal, Container,
  ChevronDown, ChevronRight, Loader2, CheckCircle2, XCircle, Clock,
  Eye,
} from 'lucide-react';
import clsx from 'clsx';
import type { ToolCallInfo } from '@/types';

/** 工具名称 → 图标 + 显示名 */
const TOOL_META: Record<string, { icon: typeof Terminal; label: string; color: string }> = {
  file_read:        { icon: FileText,    label: '读取文件',   color: 'text-blue-500' },
  file_write:       { icon: FilePlus2,   label: '写入文件',   color: 'text-emerald-500' },
  file_patch:       { icon: Replace,     label: '修改文件',   color: 'text-amber-500' },
  grep_search:      { icon: FileSearch,  label: '搜索文件',   color: 'text-violet-500' },
  execute_command:   { icon: Terminal,    label: '执行命令',   color: 'text-slate-600' },
  run_docker_tool:   { icon: Container,  label: 'Docker 工具', color: 'text-sky-600' },
};

const DEFAULT_META = { icon: Terminal, label: '工具调用', color: 'text-slate-500' };

/** 格式化毫秒时长 */
function formatDuration(ms?: number): string {
  if (ms == null) return '';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/** 将参数渲染为可读字符串（单行摘要 / 折叠详情） */
function formatArgs(args: Record<string, any>): { summary: string; full: string } {
  const entries = Object.entries(args);
  if (entries.length === 0) return { summary: '(无参数)', full: '' };

  // 摘要：取关键参数
  const key = args.path ?? args.command ?? args.pattern ?? args.image ?? '';
  const summary = typeof key === 'string' && key.length > 0
    ? key.length > 80 ? key.slice(0, 77) + '...' : key
    : JSON.stringify(args).slice(0, 80);

  const full = JSON.stringify(args, null, 2);
  return { summary, full };
}

interface ToolCallItemProps {
  tc: ToolCallInfo;
}

export default function ToolCallItem({ tc }: ToolCallItemProps) {
  const [expanded, setExpanded] = useState(false);
  const meta = TOOL_META[tc.tool] ?? DEFAULT_META;
  const Icon = meta.icon;
  const { summary, full } = formatArgs(tc.arguments);

  return (
    <div
      className={clsx(
        'rounded-md border text-xs transition-colors',
        tc.isDocker ? 'border-sky-200 bg-sky-50/40' : 'border-platinum-300 bg-platinum-100/40',
      )}
    >
      {/* 头部 */}
      <button
        onClick={() => setExpanded(prev => !prev)}
        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-left hover:bg-black/[0.02] transition-colors rounded-md"
      >
        <Icon size={13} className={clsx(meta.color, 'flex-shrink-0')} />
        <span className={clsx('font-medium flex-shrink-0', meta.color)}>{meta.label}</span>
        <span className="text-text-muted truncate flex-1 ml-1">{summary}</span>

        {/* 状态 */}
        {tc.status === 'running' && (
          <Loader2 size={13} className="text-rosegold-400 animate-spin flex-shrink-0" />
        )}
        {tc.status === 'complete' && (
          <CheckCircle2 size={13} className="text-green-500 flex-shrink-0" />
        )}
        {tc.status === 'error' && (
          <XCircle size={13} className="text-red-500 flex-shrink-0" />
        )}

        {/* 耗时 */}
        {tc.duration_ms != null && (
          <span className="text-text-tertiary flex-shrink-0 flex items-center gap-0.5">
            <Clock size={10} />
            {formatDuration(tc.duration_ms)}
          </span>
        )}

        {/* Observe 评估徽章 (收缩状态可见) */}
        {tc.observeDecision && tc.observeDecision !== 'continue' && (
          <span className={clsx(
            'text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0',
            tc.observeDecision === 'retry'
              ? 'bg-amber-100 text-amber-700'
              : 'bg-red-100 text-red-700',
          )}>
            {tc.observeDecision === 'retry' ? '重试' : '失败'}
          </span>
        )}

        {expanded
          ? <ChevronDown size={12} className="text-text-muted flex-shrink-0" />
          : <ChevronRight size={12} className="text-text-muted flex-shrink-0" />}
      </button>

      {/* 折叠详情 */}
      {expanded && (
        <div className="px-2.5 pb-2 border-t border-platinum-300/50 space-y-1.5">
          {/* 参数 */}
          {full && (
            <div className="pt-1.5">
              <div className="text-[10px] text-text-tertiary mb-0.5 uppercase tracking-wide">参数</div>
              <pre className="bg-white/60 rounded p-1.5 text-[11px] text-text-secondary overflow-x-auto max-h-40 whitespace-pre-wrap break-all font-mono">
                {full}
              </pre>
            </div>
          )}

          {/* 输出 */}
          {tc.output && (
            <div>
              <div className="text-[10px] text-text-tertiary mb-0.5 uppercase tracking-wide">输出</div>
              <pre className={clsx(
                'rounded p-1.5 text-[11px] overflow-x-auto max-h-48 whitespace-pre-wrap break-all font-mono',
                tc.status === 'error' ? 'bg-red-50 text-red-700' : 'bg-white/60 text-text-secondary',
              )}>
                {tc.output}
              </pre>
            </div>
          )}

          {/* 错误 */}
          {tc.error && (
            <div>
              <div className="text-[10px] text-red-500 mb-0.5 uppercase tracking-wide">错误</div>
              <pre className="bg-red-50 rounded p-1.5 text-[11px] text-red-700 overflow-x-auto max-h-24 whitespace-pre-wrap break-all font-mono">
                {tc.error}
              </pre>
            </div>
          )}

          {/* Observe 评估结果 */}
          {tc.observeDecision && (
            <div className={clsx(
              'flex items-start gap-1.5 rounded p-1.5 text-[11px]',
              tc.observeDecision === 'continue' ? 'bg-green-50 text-green-700' :
              tc.observeDecision === 'retry' ? 'bg-amber-50 text-amber-700' :
              'bg-red-50 text-red-700',
            )}>
              <Eye size={12} className="flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-medium">
                  {tc.observeDecision === 'continue' ? '评估通过' :
                   tc.observeDecision === 'retry' ? '需要重试' : '评估失败'}
                </span>
                {tc.observeReason && (
                  <span className="ml-1 opacity-80">{tc.observeReason}</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
