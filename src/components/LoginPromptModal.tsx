/**
 * LoginPromptModal - 游客模式登录提示弹窗
 * 
 * 当未登录用户尝试发送消息时弹出，提示去登录或注册
 */

import { useNavigate } from 'react-router-dom';
import { LogIn, UserPlus, X } from 'lucide-react';

interface LoginPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LoginPromptModal({ isOpen, onClose }: LoginPromptModalProps) {
  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 遮罩层 */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 弹窗内容 */}
      <div className="relative bg-gray-800 border border-gray-700/50 rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl">
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        {/* 图标 */}
        <div className="flex justify-center mb-5">
          <div className="w-14 h-14 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-2xl flex items-center justify-center">
            <LogIn size={28} className="text-white" />
          </div>
        </div>

        {/* 提示文字 */}
        <h3 className="text-xl font-semibold text-white text-center mb-2">
          请先登录
        </h3>
        <p className="text-gray-400 text-sm text-center mb-8">
          登录后即可开始与 BioAgent 对话
        </p>

        {/* 按钮 */}
        <div className="space-y-3">
          <button
            onClick={() => navigate('/login')}
            className="w-full py-3 px-4 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
          >
            <LogIn size={18} />
            去登录
          </button>
          <button
            onClick={() => navigate('/register')}
            className="w-full py-3 px-4 border border-gray-600 text-gray-300 hover:text-white hover:border-gray-500 font-medium rounded-lg transition-all duration-200 flex items-center justify-center gap-2"
          >
            <UserPlus size={18} />
            去注册
          </button>
        </div>
      </div>
    </div>
  );
}
