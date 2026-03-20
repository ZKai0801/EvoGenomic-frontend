import { useState, useCallback, useEffect } from 'react';
import { ArrowUp, ArrowDown, Trash2, Plus, Play, X, RotateCw } from 'lucide-react';
import clsx from 'clsx';
import type { PlanData, PlanStep } from '@/types';

interface PlanPanelProps {
  planData: PlanData;
  isEditable: boolean;
  isExecuting?: boolean;
  onConfirm: (plan: PlanData) => void;
  onExit: () => void;
  onExecute?: (stepIds?: number[]) => void;
}

/** 步骤状态对应的图标 */
function StatusIcon({ status }: { status: PlanStep['status'] }) {
  switch (status) {
    case 'pending':
      return <span className="w-5 h-5 rounded-full border-2 border-platinum-500 inline-block flex-shrink-0" />;
    case 'running':
      return <span className="w-5 h-5 rounded-full bg-accent-primary animate-pulse inline-block flex-shrink-0" />;
    case 'complete':
      return (
        <span className="w-5 h-5 rounded-full bg-green-500 text-white inline-flex items-center justify-center flex-shrink-0 text-xs">
          ✓
        </span>
      );
    case 'error':
      return (
        <span className="w-5 h-5 rounded-full bg-red-500 text-white inline-flex items-center justify-center flex-shrink-0 text-xs">
          ✗
        </span>
      );
    case 'skipped':
      return (
        <span className="w-5 h-5 rounded-full bg-platinum-400 text-white inline-flex items-center justify-center flex-shrink-0 text-xs">
          ⊘
        </span>
      );
    default:
      return <span className="w-5 h-5 rounded-full border-2 border-platinum-500 inline-block flex-shrink-0" />;
  }
}

export default function PlanPanel({ planData, isEditable, isExecuting = false, onConfirm, onExit, onExecute }: PlanPanelProps) {
  const [steps, setSteps] = useState<PlanStep[]>(() => planData.plan.map(s => ({ ...s })));
  const [goal, setGoal] = useState(planData.goal);

  // 当 planData 变化时（例如切换聊天），同步本地状态
  useEffect(() => {
    setSteps(planData.plan.map(s => ({ ...s })));
    setGoal(planData.goal);
  }, [planData]);

  /** 重新编号所有步骤 */
  const renumber = useCallback((list: PlanStep[]): PlanStep[] => {
    return list.map((s, i) => ({ ...s, step_id: i + 1 }));
  }, []);

  const moveStep = useCallback((index: number, direction: -1 | 1) => {
    setSteps(prev => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return renumber(next);
    });
  }, [renumber]);

  const deleteStep = useCallback((index: number) => {
    setSteps(prev => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((_, i) => i !== index);
      return renumber(next);
    });
  }, [renumber]);

  const addStep = useCallback(() => {
    setSteps(prev => renumber([
      ...prev,
      {
        step_id: prev.length + 1,
        description: '',
        depend_on: null,
        expected_output: '',
        reference: null,
        status: 'pending',
        output: null,
      },
    ]));
  }, [renumber]);

  const updateDescription = useCallback((index: number, value: string) => {
    setSteps(prev => prev.map((s, i) => i === index ? { ...s, description: value } : s));
  }, []);

  const handleConfirm = useCallback(() => {
    // 用编辑后的步骤构建完整 plan，保留原始 reference/expected_output/output
    const mergedSteps = steps.map((editedStep, i) => {
      const original = planData.plan[i];
      return {
        ...editedStep,
        expected_output: editedStep.expected_output || original?.expected_output || '',
        reference: editedStep.reference ?? original?.reference ?? null,
        output: editedStep.output ?? original?.output ?? null,
      };
    });
    onConfirm({ goal, plan: mergedSteps });
  }, [steps, goal, planData, onConfirm]);

  return (
    <div className="flex flex-col h-full">
      {/* 标题 */}
      <div className="px-3 py-2 border-b border-platinum-400">
        <h3 className="text-sm font-medium text-text-primary truncate" title={goal}>
          {goal || '执行计划'}
        </h3>
      </div>

      {/* 步骤列表 */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-2">
        {steps.map((step, index) => (
          <div
            key={step.step_id}
            className={clsx(
              'rounded-lg border p-2.5 text-xs transition-colors',
              step.status === 'error'
                ? 'border-red-200 bg-red-50/50'
                : step.status === 'complete'
                  ? 'border-green-200 bg-green-50/50'
                  : step.status === 'running'
                    ? 'border-accent-light bg-rosegold-50/30'
                    : step.status === 'skipped'
                      ? 'border-platinum-300 bg-platinum-100/60 opacity-60'
                      : 'border-platinum-400 bg-white',
            )}
          >
            {/* 头部：状态 + 编号 + 操作 */}
            <div className="flex items-center gap-1.5 mb-1">
              <StatusIcon status={step.status} />
              <span className="font-medium text-text-secondary">步骤 {step.step_id}</span>
              {step.depend_on != null && (
                <span className="text-text-muted ml-auto text-[10px]">
                  依赖: {step.depend_on}
                </span>
              )}
              {/* 非编辑模式下：已完成/出错 步骤的重新执行按钮 */}
              {!isEditable && onExecute && (step.status === 'complete' || step.status === 'error' || step.status === 'skipped') && (
                <button
                  onClick={() => onExecute([step.step_id])}
                  disabled={isExecuting}
                  className="ml-auto p-0.5 rounded hover:bg-platinum-300 disabled:opacity-30 text-text-muted hover:text-accent-primary"
                  title="重新执行此步骤"
                >
                  <RotateCw size={12} />
                </button>
              )}
              {isEditable && (
                <div className="flex items-center gap-0.5 ml-auto">
                  <button
                    onClick={() => moveStep(index, -1)}
                    disabled={index === 0}
                    className="p-0.5 rounded hover:bg-platinum-300 disabled:opacity-30 text-text-muted"
                    title="上移"
                  >
                    <ArrowUp size={12} />
                  </button>
                  <button
                    onClick={() => moveStep(index, 1)}
                    disabled={index === steps.length - 1}
                    className="p-0.5 rounded hover:bg-platinum-300 disabled:opacity-30 text-text-muted"
                    title="下移"
                  >
                    <ArrowDown size={12} />
                  </button>
                  <button
                    onClick={() => deleteStep(index)}
                    disabled={steps.length <= 1}
                    className="p-0.5 rounded hover:bg-red-100 disabled:opacity-30 text-text-muted hover:text-red-500"
                    title="删除"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )}
            </div>

            {/* 描述 */}
            {isEditable ? (
              <textarea
                value={step.description}
                onChange={e => updateDescription(index, e.target.value)}
                rows={2}
                className="w-full px-2 py-1 text-xs rounded border border-platinum-400 bg-platinum-50
                  focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-light
                  resize-none text-text-primary"
              />
            ) : (
              <p className="text-text-primary leading-relaxed">{step.description}</p>
            )}
          </div>
        ))}

        {/* 添加步骤按钮 */}
        {isEditable && (
          <button
            onClick={addStep}
            className="w-full py-1.5 rounded-lg border border-dashed border-platinum-500
              text-text-muted hover:text-accent-primary hover:border-accent-primary
              text-xs flex items-center justify-center gap-1 transition-colors"
          >
            <Plus size={12} />
            添加步骤
          </button>
        )}
      </div>

      {/* 底部按钮栏 — 编辑模式 */}
      {isEditable && (
        <div className="px-3 py-2 border-t border-platinum-400 flex gap-2">
          <button
            onClick={handleConfirm}
            className="flex-1 py-1.5 rounded-lg text-xs font-medium
              bg-accent-primary text-white hover:bg-accent-hover
              flex items-center justify-center gap-1 transition-colors"
          >
            <Play size={12} />
            确认执行
          </button>
          <button
            onClick={onExit}
            className="px-3 py-2 rounded-lg text-xs font-medium
              border border-platinum-400 text-text-secondary hover:bg-platinum-300
              flex items-center justify-center gap-1 transition-colors"
          >
            <X size={12} />
            退出
          </button>
        </div>
      )}

      {/* 底部按钮栏 — 非编辑模式：手动执行 / 全部重新执行 */}
      {!isEditable && onExecute && (() => {
        const hasPending = steps.some(s => s.status === 'pending');
        const hasCompleteOrError = steps.some(s => s.status === 'complete' || s.status === 'error');
        if (!hasPending && !hasCompleteOrError) return null;
        return (
          <div className="px-3 py-2 border-t border-platinum-400 flex gap-2">
            {hasPending && (
              <button
                onClick={() => onExecute()}
                disabled={isExecuting}
                className="flex-1 py-1.5 rounded-lg text-xs font-medium
                  bg-accent-primary text-white hover:bg-accent-hover disabled:opacity-50
                  flex items-center justify-center gap-1 transition-colors"
              >
                <Play size={12} />
                {isExecuting ? '执行中...' : '开始执行'}
              </button>
            )}
            {!hasPending && hasCompleteOrError && (
              <button
                onClick={() => {
                  const allIds = steps.map(s => s.step_id);
                  onExecute(allIds);
                }}
                disabled={isExecuting}
                className="flex-1 py-1.5 rounded-lg text-xs font-medium
                  border border-accent-primary text-accent-primary hover:bg-rosegold-50/30 disabled:opacity-50
                  flex items-center justify-center gap-1 transition-colors"
              >
                <RotateCw size={12} />
                {isExecuting ? '执行中...' : '全部重新执行'}
              </button>
            )}
          </div>
        );
      })()}
    </div>
  );
}
