/**
 * 注册页面组件 - 支持邮箱验证码 + 邀请码
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApiClient } from '@/api';

export function RegisterPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [invitationCode, setInvitationCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // 邀请码配置
  const [invitationCodeRequired, setInvitationCodeRequired] = useState(false);
  const [registrationFull, setRegistrationFull] = useState(false);
  
  // 验证码状态
  const [codeSending, setCodeSending] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // 加载注册配置（是否需要邀请码）
  useEffect(() => {
    authApiClient.getRegisterConfig()
      .then(config => {
        setInvitationCodeRequired(config.invitation_code_required);
        setRegistrationFull(config.registration_full ?? false);
      })
      .catch(() => {}); // 如果接口失败，默认不要求邀请码
  }, []);

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
    if (invitationCodeRequired && !invitationCode.trim()) {
      return '请输入邀请码';
    }
    if (username.length < 3) {
      return '用户名至少需要3个字符';
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return '用户名只能包含字母、数字和下划线';
    }
    if (!validateEmail(email)) {
      return '请输入有效的邮箱地址';
    }
    if (password.length < 8) {
      return '密码至少需要8个字符';
    }
    if (!/[A-Z]/.test(password)) {
      return '密码必须包含至少一个大写字母';
    }
    if (!/[a-z]/.test(password)) {
      return '密码必须包含至少一个小写字母';
    }
    if (!/[0-9]/.test(password)) {
      return '密码必须包含至少一个数字';
    }
    if (password !== confirmPassword) {
      return '两次输入的密码不一致';
    }
    if (code.length !== 6) {
      return '请输入6位验证码';
    }
    return null;
  };

  // 发送验证码
  const handleSendCode = async () => {
    if (!validateEmail(email)) {
      setError('请输入有效的邮箱地址');
      return;
    }
    
    setError('');
    setCodeSending(true);
    
    try {
      await authApiClient.sendCode(email);
      setCodeSent(true);
      setCountdown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : '验证码发送失败');
    } finally {
      setCodeSending(false);
    }
  };

  // 提交注册
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
      await authApiClient.register({
        username,
        email,
        password,
        code,
        ...(invitationCodeRequired ? { invitation_code: invitationCode } : {}),
      });
      navigate('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败');
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

        {/* 注册表单 */}
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 border border-gray-700/50 shadow-xl">
          <h2 className="text-xl font-semibold text-white mb-6 text-center">创建账户</h2>
          
          {registrationFull && (
            <div className="p-4 mb-4 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 text-sm text-center">
              内测阶段，服务器已满，目前无法注册
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* 邀请码（仅在启用时显示） */}
            {invitationCodeRequired && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  邀请码 <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={invitationCode}
                  onChange={(e) => setInvitationCode(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  placeholder="请输入邀请码"
                  required
                />
              </div>
            )}

            {/* 用户名 */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                用户名
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                placeholder="3-50个字符，仅限字母数字下划线"
                required
              />
            </div>

            {/* 邮箱 + 验证码发送按钮 */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                邮箱
              </label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="flex-1 px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  placeholder="请输入邮箱地址"
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

            {/* 密码 */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                密码
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                placeholder="至少8位，包含大小写字母和数字"
                required
              />
            </div>

            {/* 确认密码 */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                确认密码
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                placeholder="请再次输入密码"
                required
              />
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* 注册按钮 */}
            <button
              type="submit"
              disabled={loading || !codeSent || registrationFull}
              className="w-full py-3 px-4 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mt-6"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  注册中...
                </span>
              ) : (
                '注 册'
              )}
            </button>
          </form>

          {/* 分隔线 */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-gray-800/50 text-gray-400">已有账户?</span>
            </div>
          </div>

          {/* 登录链接 */}
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
