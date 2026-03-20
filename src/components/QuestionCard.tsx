import { useState } from 'react';
import { HelpCircle, Check, Container } from 'lucide-react';
import clsx from 'clsx';
import type { QuestionData } from '@/types';

export type { QuestionData };

interface QuestionCardProps {
  question: QuestionData;
  onAnswer: (answer: string) => void;
  disabled?: boolean;
}

/**
 * Human-in-the-Loop 提问卡片
 *
 * Agent 暂停执行后向用户展示选项卡，用户选择后恢复执行。
 */
export default function QuestionCard({ question, onAnswer, disabled = false }: QuestionCardProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [freeformText, setFreeformText] = useState('');
  const [answered, setAnswered] = useState(false);

  const handleSelect = (option: string) => {
    if (answered || disabled) return;
    setSelected(option);
    setAnswered(true);
    onAnswer(option);
  };

  const handleFreeformSubmit = () => {
    if (answered || disabled || !freeformText.trim()) return;
    setSelected(freeformText.trim());
    setAnswered(true);
    onAnswer(freeformText.trim());
  };

  return (
    <div className={clsx(
      'mt-3 rounded-xl border p-4 shadow-sm',
      question.docker_tool
        ? 'border-sky-200 bg-gradient-to-br from-sky-50/50 to-white'
        : 'border-rosegold-200 bg-gradient-to-br from-rosegold-50/50 to-white',
    )}>
      {/* 问题标题 */}
      <div className="flex items-start gap-2 mb-3">
        {question.docker_tool
          ? <Container size={18} className="text-sky-500 mt-0.5 flex-shrink-0" />
          : <HelpCircle size={18} className="text-rosegold-400 mt-0.5 flex-shrink-0" />}
        <p className="text-sm font-medium text-text-primary">{question.text}</p>
      </div>

      {/* Docker 工具详情 */}
      {question.docker_tool && (
        <div className="mb-3 ml-6 rounded-lg border border-sky-200 bg-sky-50/60 p-3 text-xs font-mono space-y-1">
          <div className="flex gap-2">
            <span className="text-sky-600 font-semibold flex-shrink-0">镜像:</span>
            <span className="text-text-primary break-all">{question.docker_tool.image || 'N/A'}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-sky-600 font-semibold flex-shrink-0">命令:</span>
            <span className="text-text-primary break-all">{question.docker_tool.command || 'N/A'}</span>
          </div>
          {question.docker_tool.workdir && question.docker_tool.workdir !== '/workspace' && (
            <div className="flex gap-2">
              <span className="text-sky-600 font-semibold flex-shrink-0">工作目录:</span>
              <span className="text-text-primary">{question.docker_tool.workdir}</span>
            </div>
          )}
        </div>
      )}

      {/* 上下文说明 */}
      {question.context && !question.docker_tool && (
        <p className="text-xs text-text-secondary mb-3 ml-6">{question.context}</p>
      )}

      {/* 选项按钮 */}
      <div className="flex flex-wrap gap-2 ml-6">
        {question.options.map((option, index) => (
          <button
            key={option}
            onClick={() => handleSelect(option)}
            disabled={answered || disabled}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
              'border',
              selected === option
                ? 'bg-rosegold-400 text-white border-rosegold-400 shadow-sm'
                : answered
                  ? 'bg-platinum-100 text-text-tertiary border-platinum-300 cursor-not-allowed opacity-60'
                  : index === 0
                    ? 'bg-rosegold-50 text-text-primary border-rosegold-300 hover:border-rosegold-400 hover:bg-rosegold-100 active:bg-rosegold-200'
                    : 'bg-white text-text-primary border-platinum-400 hover:border-rosegold-300 hover:bg-rosegold-50 active:bg-rosegold-100'
            )}
          >
            {selected === option && <Check size={14} className="inline mr-1 -mt-0.5" />}
            {option}
          </button>
        ))}
      </div>

      {/* 自由文本输入 */}
      {question.allow_freeform && !answered && (
        <div className="mt-3 ml-6 flex gap-2">
          <input
            type="text"
            value={freeformText}
            onChange={(e) => setFreeformText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleFreeformSubmit()}
            placeholder="或输入自定义内容..."
            disabled={disabled}
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-platinum-400 bg-white
              focus:outline-none focus:border-rosegold-300 focus:ring-1 focus:ring-rosegold-200
              placeholder:text-text-tertiary"
          />
          <button
            onClick={handleFreeformSubmit}
            disabled={!freeformText.trim() || disabled}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-rosegold-400 text-white
              hover:bg-rosegold-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            确定
          </button>
        </div>
      )}

      {/* 已回答提示 */}
      {answered && (
        <p className="text-xs text-text-tertiary mt-2 ml-6">
          ✓ 已选择：{selected}
        </p>
      )}
    </div>
  );
}
