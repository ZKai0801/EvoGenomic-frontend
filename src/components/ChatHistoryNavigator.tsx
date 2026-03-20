/**
 * 聊天历史记录导航组件
 * 
 * 在聊天框左上角显示一个图标，点击后展开用户消息列表
 * 可以快速跳转到对话中的任意用户消息位置
 */
import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { Message } from '@/types';
import clsx from 'clsx';

interface ChatHistoryNavigatorProps {
  messages: Message[];
  onJumpToMessage: (messageId: string) => void;
}

function StackedDashIcon({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex flex-col items-center justify-center leading-none ${className}`} aria-hidden="true">
      <span className="block -mb-2">—</span>
      <span className="block -mb-2">—</span>
      <span className="block">—</span>
    </span>
  );
}

export default function ChatHistoryNavigator({
  messages,
  onJumpToMessage,
}: ChatHistoryNavigatorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // 只显示用户消息
  const userMessages = messages.filter(msg => msg.role === 'user');

  // 点击外部关闭面板
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleMessageClick = (messageId: string) => {
    onJumpToMessage(messageId);
    setIsOpen(false);
  };

  // 格式化时间
  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  // 截取消息前几个字
  const truncateContent = (content: string, maxLength: number = 30) => {
    return content.length > maxLength
      ? content.slice(0, maxLength) + '...'
      : content;
  };

  if (userMessages.length === 0) {
    return null;
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* 触发按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'p-2 rounded-lg transition-all duration-200',
          isOpen
            ? 'bg-rosegold-100 text-rosegold-600'
            : 'text-text-secondary hover:bg-platinum-200 hover:text-text-primary'
        )}
        title="聊天历史"
      >
        <StackedDashIcon className="text-lg" />
      </button>

      {/* 历史记录面板 */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-80 bg-white rounded-xl shadow-luxury-lg border border-platinum-300 z-50 max-h-96 overflow-hidden flex flex-col">
          {/* 面板头部 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-platinum-300">
            <div className="flex items-center gap-2">
                <StackedDashIcon className="text-rosegold-500 text-base" />
              <h3 className="text-sm font-medium text-text-primary">
                聊天历史 ({userMessages.length})
              </h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 text-text-secondary hover:text-text-primary hover:bg-platinum-200 rounded transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* 消息列表 */}
          <div className="overflow-y-auto flex-1">
            {userMessages.map((msg, index) => (
              <button
                key={msg.id}
                onClick={() => handleMessageClick(msg.id)}
                className="w-full px-4 py-3 text-left hover:bg-platinum-100 transition-colors border-b border-platinum-200 last:border-b-0"
              >
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-6 h-6 bg-gradient-to-br from-rosegold-300 to-rosegold-500 rounded-full flex items-center justify-center text-white text-xs font-medium">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary line-clamp-2 mb-1">
                      {truncateContent(msg.content)}
                    </p>
                    <p className="text-xs text-text-muted">
                      {formatTime(msg.timestamp)}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
