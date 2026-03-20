/**
 * AuthGuard - 认证守卫组件
 * 
 * 未登录时以游客模式渲染子组件（isGuest=true），
 * 登录后提供完整认证上下文。
 * 登录/注册/忘记密码页面已独立为单独路由，不再由 AuthGuard 管理。
 */

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { authApiClient, UserInfo } from '@/api';

// 认证上下文类型
interface AuthContextType {
  user: UserInfo | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

// 创建认证上下文
const AuthContext = createContext<AuthContextType | null>(null);

// 认证上下文 Hook
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

// 认证守卫属性
interface AuthGuardProps {
  children: ReactNode;
}

/**
 * AuthGuard 组件
 * 
 * 始终渲染 children；未登录时 isGuest=true，已登录时 isGuest=false
 */
export function AuthGuard({ children }: AuthGuardProps) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // 初始化：检查登录状态
  useEffect(() => {
    checkAuth();
  }, []);

  // 检查认证状态
  const checkAuth = async () => {
    if (!authApiClient.isAuthenticated()) {
      setLoading(false);
      return;
    }

    try {
      // 尝试获取用户信息
      const userInfo = await authApiClient.getMe();
      setUser(userInfo);
      authApiClient.saveUserInfo(userInfo);
    } catch (error) {
      console.error('Auth check failed:', error);
      // 认证失败，清除 token
      authApiClient.clearTokens();
    } finally {
      setLoading(false);
    }
  };

  // 刷新用户信息
  const refreshUser = async () => {
    try {
      const userInfo = await authApiClient.getMe();
      setUser(userInfo);
      authApiClient.saveUserInfo(userInfo);
    } catch (error) {
      console.error('Refresh user failed:', error);
    }
  };

  // 登出
  const logout = async () => {
    try {
      await authApiClient.logout();
    } finally {
      setUser(null);
    }
  };

  // 加载中
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-2xl mb-4 animate-pulse">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-gray-400">正在加载...</p>
        </div>
      </div>
    );
  }

  // 始终渲染 children，通过 isGuest 区分游客/已登录
  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      isGuest: !user,
      logout,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
