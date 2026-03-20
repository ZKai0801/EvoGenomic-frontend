import { X, Brain, Wrench, CheckCircle, AlertCircle, Loader2, ChevronDown, ChevronRight, Code } from 'lucide-react';
import { AgentWorkStep } from '@/types';
import clsx from 'clsx';
import { useState } from 'react';

interface AgentWorkPanelProps {
  isOpen: boolean;
  onClose: () => void;
  workSteps: AgentWorkStep[];
}

const stepTypeConfig: Record<string, { icon: typeof Brain; color: string; bgColor: string; label: string }> = {
  thinking: {
    icon: Brain,
    color: 'text-rosegold-400',
    bgColor: 'bg-rosegold-100',
    label: '思考',
  },
  tool_call: {
    icon: Wrench,
    color: 'text-slate-500',
    bgColor: 'bg-slate-100',
    label: '工具调用',
  },
  result: {
    icon: CheckCircle,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-50',
    label: '结果',
  },
  error: {
    icon: AlertCircle,
    color: 'text-rose-400',
    bgColor: 'bg-rose-50',
    label: '错误',
  },
  receiving: {
    icon: Brain,
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
    label: '接收',
  },
  responding: {
    icon: CheckCircle,
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-50',
    label: '回复',
  },
};

const statusConfig: Record<string, { icon: typeof Loader2 | null; color: string; label: string; spin?: boolean }> = {
  pending: {
    icon: null,
    color: 'text-text-muted',
    label: '等待中',
  },
  running: {
    icon: Loader2,
    color: 'text-rosegold-400',
    label: '执行中',
    spin: true,
  },
  completed: {
    icon: CheckCircle,
    color: 'text-emerald-500',
    label: '已完成',
  },
  error: {
    icon: AlertCircle,
    color: 'text-rose-400',
    label: '错误',
  },
};

// 默认配置，用于未知类型
const defaultTypeConfig = {
  icon: Brain,
  color: 'text-slate-500',
  bgColor: 'bg-slate-100',
  label: '未知',
};

const defaultStatusConfig = {
  icon: null,
  color: 'text-text-muted',
  label: '未知',
};

function WorkStepItem({ step }: { step: AgentWorkStep }) {
  const [isExpanded, setIsExpanded] = useState(true);
  // 使用防御性检查，如果类型不存在则使用默认配置
  const typeConfig = stepTypeConfig[step.type] || defaultTypeConfig;
  const status = statusConfig[step.status] || defaultStatusConfig;
  const TypeIcon = typeConfig.icon;
  const StatusIcon = status.icon;

  return (
    <div className={clsx(
      'border rounded-xl overflow-hidden bg-white shadow-luxury',
      step.status === 'running' ? 'border-rosegold-300 shadow-accent' : 'border-platinum-400'
    )}>
      {/* Step header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 p-3 hover:bg-platinum-200 transition-colors"
      >
        <div className={clsx('p-1.5 rounded-lg', typeConfig.bgColor)}>
          <TypeIcon size={16} className={typeConfig.color} />
        </div>
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-text-primary">{step.title}</span>
            <span className={clsx('text-xs px-2 py-0.5 rounded-full', typeConfig.bgColor, typeConfig.color)}>
              {typeConfig.label}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {step.status === 'running' && StatusIcon && (
            <StatusIcon size={16} className={clsx(status.color, 'spinner')} />
          )}
          {step.status === 'completed' && StatusIcon && (
            <StatusIcon size={16} className={status.color} />
          )}
          {step.status === 'error' && StatusIcon && (
            <StatusIcon size={16} className={status.color} />
          )}
          {isExpanded ? (
            <ChevronDown size={16} className="text-text-muted" />
          ) : (
            <ChevronRight size={16} className="text-text-muted" />
          )}
        </div>
      </button>

      {/* Step content */}
      {isExpanded && (
        <div className="border-t border-platinum-400">
          {step.type === 'tool_call' || step.type === 'result' ? (
            <div className="bg-gradient-to-br from-platinum-100 to-platinum-200 p-4">
              <div className="flex items-center gap-2 mb-2 text-text-muted text-xs">
                <Code size={12} />
                <span>R Code</span>
              </div>
              <pre className="text-sm text-text-primary overflow-x-auto font-mono">
                <code>{step.content}</code>
              </pre>
            </div>
          ) : (
            <div className="p-4">
              <p className="text-sm text-text-secondary whitespace-pre-wrap leading-relaxed">{step.content}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AgentWorkPanel({ isOpen, onClose, workSteps }: AgentWorkPanelProps) {
  if (!isOpen) return null;

  const runningSteps = workSteps.filter(s => s.status === 'running').length;
  const completedSteps = workSteps.filter(s => s.status === 'completed').length;
  const totalSteps = workSteps.length;

  return (
    <div className="w-96 h-full bg-white border-l border-platinum-400 flex flex-col agent-panel-enter shadow-luxury-lg">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-platinum-400 bg-gradient-to-r from-platinum-100 to-white">
        <div>
          <h2 className="text-lg font-semibold text-text-primary tracking-tight">Agent 工作详情</h2>
          <p className="text-sm text-text-muted">
            {runningSteps > 0 ? (
              <span className="flex items-center gap-1.5">
                <Loader2 size={12} className="spinner text-rosegold-400" />
                正在执行...
              </span>
            ) : (
              `已完成 ${completedSteps}/${totalSteps} 步`
            )}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-platinum-200 rounded-lg transition-colors text-text-muted hover:text-text-primary"
        >
          <X size={20} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-4 py-3">
        <div className="h-1.5 bg-platinum-300 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-rosegold-300 to-rosegold-500 transition-all duration-300 rounded-full"
            style={{ width: `${(completedSteps / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Work steps */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-white to-platinum-100">
        {workSteps.map((step) => (
          <WorkStepItem key={step.id} step={step} />
        ))}

        {workSteps.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-text-muted">
            <Brain size={48} className="mb-4 opacity-40 text-rosegold-300" />
            <p className="text-center">等待 Agent 开始工作...</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-platinum-400 bg-white">
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>执行时间: 12.5s</span>
          <span>Token 使用: 1,234</span>
        </div>
      </div>
    </div>
  );
}
