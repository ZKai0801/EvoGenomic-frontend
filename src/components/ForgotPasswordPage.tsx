/**
 * 忘记密码页面组件 - 邮箱验证码重置密码
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApiClient } from '@/api';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 验证码状态
  const [codeSending, setCodeSending] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // 倒计时
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const validateForm = (): string | null => {
    if (!validateEmail(email)) {
      return '请输入有效的邮箱地址';
    }
    if (code.length !== 6) {
      return '请输入6位验证码';
    }
    if (newPassword.length < 8) {
      return '密码至少需要8个字符';
    }
    if (!/[A-Z]/.test(newPassword)) {
      return '密码必须包含至少一个大写字母';
    }
    if (!/[a-z]/.test(newPassword)) {
      return '密码必须包含至少一个小写字母';
    }
    if (!/[0-9]/.test(newPassword)) {
      return '密码必须包含至少一个数字';
    }
    if (newPassword !== confirmPassword) {
      return '两次输入的密码不一致';
    }
    return null;
  };

  // 发送重置验证码
  const handleSendCode = async () => {
    if (!validateEmail(email)) {
      setError('请输入有效的邮箱地址');
      return;
    }

    setError('');
    setCodeSending(true);

    try {
      await authApiClient.sendResetCode(email);
      setCodeSent(true);
      setCountdown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : '验证码发送失败');
    } finally {
      setCodeSending(false);
    }
  };

  // 提交重置密码
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      await authApiClient.resetPassword({ email, code, new_password: newPassword });
      navigate('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : '密码重置失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / 标题 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-2xl mb-4">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white">BioAgent</h1>
          <p className="text-gray-400 mt-2">生物信息学 AI 智能平台</p>
        </div>

        {/* 重置密码表单 */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700/50 shadow-xl">
          <h2 className="text-xl font-semibold text-white mb-2 text-center">重置密码</h2>
          <p className="text-gray-400 text-sm text-center mb-6">输入注册邮箱，我们将发送验证码</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 邮箱 + 验证码发送按钮 */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                注册邮箱
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  placeholder="请输入注册邮箱"
                  required
                />
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={codeSending || countdown > 0 || !email}
                  className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors whitespace-nowrap min-w-[100px]"
                >
                  {codeSending ? (
                    <svg className="animate-spin h-5 w-5 mx-auto" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : countdown > 0 ? (
                    `${countdown}s`
                  ) : codeSent ? (
                    '重新发送'
                  ) : (
                    '发送验证码'
                  )}
                </button>
              </div>
            </div>

            {/* 验证码 */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                验证码
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all tracking-widest text-center text-lg"
                placeholder="请输入6位验证码"
                maxLength={6}
                required
              />
              {codeSent && (
                <p className="mt-1 text-xs text-gray-400">
                  验证码已发送到 {email}，10分钟内有效
                </p>
              )}
            </div>

            {/* 新密码 */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                新密码
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                placeholder="至少8位，包含大小写字母和数字"
                required
              />
            </div>

            {/* 确认新密码 */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                确认新密码
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                placeholder="请再次输入新密码"
                required
              />
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* 重置按钮 */}
            <button
              type="submit"
              disabled={loading || !codeSent}
              className="w-full py-3 px-4 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  重置中...
                </span>
              ) : (
                '重置密码'
              )}
            </button>
          </form>

          {/* 分隔线 */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-gray-800/50 text-gray-400">想起密码了?</span>
            </div>
          </div>

          {/* 返回登录 */}
          <button
            onClick={() => navigate('/login')}
            className="w-full py-3 px-4 border border-gray-600 text-gray-300 hover:text-white hover:border-gray-500 font-medium rounded-lg transition-all duration-200"
          >
            返回登录
          </button>
        </div>

        {/* 底部信息 */}
        <p className="text-center text-gray-500 text-sm mt-6">
          © 2026 BioAgent. All rights reserved.
        </p>
      </div>
    </div>
  );
}
