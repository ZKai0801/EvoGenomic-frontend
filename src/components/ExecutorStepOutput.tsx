import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import clsx from 'clsx';
import ToolCallItem from './ToolCallItem';
import type { StepOutput, PlanStep, ToolCallInfo } from '@/types';

const MarkdownRenderer = lazy(() => import('./MarkdownRenderer'));

/** 步骤状态对应的小图标 */
function StepStatusDot({ status }: { status: StepOutput['status'] }) {
  switch (status) {
    case 'running':
      return <span className="w-2.5 h-2.5 rounded-full bg-accent-primary animate-pulse inline-block flex-shrink-0" />;
    case 'complete':
      return <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block flex-shrink-0" />;
    case 'error':
      return <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block flex-shrink-0" />;
    case 'skipped':
    case 'cancelled':
      return <span className="w-2.5 h-2.5 rounded-full bg-platinum-400 inline-block flex-shrink-0" />;
    default:
      return <span className="w-2.5 h-2.5 rounded-full border border-platinum-500 inline-block flex-shrink-0" />;
  }
}

interface ExecutorStepOutputProps {
  stepOutputs: Map<number, StepOutput>;
  planSteps: PlanStep[];
  toolCalls?: Map<number, ToolCallInfo[]>;
}

export default function ExecutorStepOutput({ stepOutputs, planSteps, toolCalls }: ExecutorStepOutputProps) {
  const [expandedStepId, setExpandedStepId] = useState<number | null>(null);
  // 追踪上一次 running 的步骤，实现自动展开/收缩
  const prevRunningRef = useRef<number | null>(null);

  // 自动展开当前 running 步骤，收缩前一步
  useEffect(() => {
    let currentRunning: number | null = null;
    for (const [, output] of stepOutputs) {
      if (output.status === 'running') {
        currentRunning = output.step_id;
        break;
      }
    }
    if (currentRunning !== null && currentRunning !== prevRunningRef.current) {
      setExpandedStepId(currentRunning);
      prevRunningRef.current = currentRunning;
    }
  }, [stepOutputs]);

  // 构建有效的 stepOutputs：优先使用实时流数据，回退到 planSteps 中已有 output 的步骤
  const effectiveOutputs = stepOutputs.size > 0
    ? stepOutputs
    : new Map(
        planSteps
          .filter(s => s.output && s.status !== 'pending' && s.status !== 'running')
          .map(s => [s.step_id, { step_id: s.step_id, content: s.output!, status: s.status as StepOutput['status'] }])
      );

  const visibleSteps = planSteps.filter(s => effectiveOutputs.has(s.step_id));
  if (visibleSteps.length === 0) return null;

  return (
    <div className="mt-3 space-y-1.5">
      {visibleSteps.map(step => {
        const output = effectiveOutputs.get(step.step_id)!;
        const isExpanded = expandedStepId === step.step_id;

        return (
          <div
            key={step.step_id}
            className={clsx(
              'rounded-lg border text-xs transition-colors',
              output.status === 'error'
                ? 'border-red-200 bg-red-50/40'
                : output.status === 'complete'
                  ? 'border-green-200 bg-green-50/40'
                  : output.status === 'skipped' || output.status === 'cancelled'
                    ? 'border-platinum-300 bg-platinum-100/40 opacity-60'
                    : 'border-accent-light bg-rosegold-50/30',
            )}
          >
            {/* 可点击的头部 */}
            <button
              onClick={() => setExpandedStepId(isExpanded ? null : step.step_id)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-black/[0.02] transition-colors rounded-lg"
            >
              <StepStatusDot status={output.status} />
              <span className="font-medium text-text-secondary flex-shrink-0">
                步骤 {step.step_id}
              </span>
              <span className="text-text-muted truncate flex-1">
                {step.description}
              </span>
              {isExpanded
                ? <ChevronDown size={14} className="text-text-muted flex-shrink-0" />
                : <ChevronRight size={14} className="text-text-muted flex-shrink-0" />}
            </button>

            {/* 展开的内容区域 */}
            {isExpanded && (
              <div className="px-3 pb-3 border-t border-platinum-300/50">
                {/* 工具调用序列 */}
                {toolCalls && toolCalls.get(step.step_id) && (
                  <div className="pt-2 space-y-1">
                    {toolCalls.get(step.step_id)!.map(tc => (
                      <ToolCallItem key={tc.id} tc={tc} />
                    ))}
                  </div>
                )}
                {/* LLM 文本输出 */}
                <div className="pt-2 text-text-primary text-xs leading-relaxed">
                  {output.content ? (
                    <>
                      <Suspense
                        fallback={
                          <div className="whitespace-pre-wrap break-words leading-relaxed">
                            {output.content}
                          </div>
                        }
                      >
                        <MarkdownRenderer content={output.content} />
                      </Suspense>
                      {output.status === 'running' && (
                        <span className="inline-block w-1.5 h-3.5 ml-0.5 bg-rosegold-500 animate-pulse" />
                      )}
                    </>
                  ) : (
                    output.status === 'running' && (
                      <div className="flex items-center gap-1.5 text-text-muted">
                        <div className="w-1.5 h-1.5 bg-rosegold-400 rounded-full animate-pulse" />
                        <span>正在执行...</span>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
