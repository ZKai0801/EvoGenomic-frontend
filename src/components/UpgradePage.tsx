/**
 * 升级套餐页面 - 独立全屏页面
 * 
 * 展示三个定价方案：基础版（充值）、Pro版（月订阅）、企业本地版（联系咨询）
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Zap, Crown, Building2, Check, Sparkles, X } from 'lucide-react';
import { chatApiClient } from '@/api';
import type { UserBalanceResponse, SubscriptionResponse } from '@/api/types';

// 充值档位
const RECHARGE_TIERS = [
  { amount: 50, credits: 500, label: '¥50' },
  { amount: 100, credits: 1100, label: '¥100', bonus: '赠 100' },
  { amount: 500, credits: 6000, label: '¥500', bonus: '赠 1000' },
  { amount: 1000, credits: 13000, label: '¥1000', bonus: '赠 3000' },
];

// Pro 特权列表
const PRO_FEATURES = [
  '无限对话次数',
  '优先任务队列',
  '高级分析模型',
  '专属技术支持',
  '更大文件上传限制',
  '更长执行时间',
];

// 企业版特权列表
const ENTERPRISE_FEATURES = [
  '本地私有化部署',
  '数据完全自主可控',
  '定制化功能开发',
  '专属技术团队支持',
  'SLA 服务保障',
  '无限用户账号',
];

export function UpgradePage() {
  const navigate = useNavigate();
  const [balance, setBalance] = useState<UserBalanceResponse | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionResponse | null>(null);
  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState('');
  const [showContactModal, setShowContactModal] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const [bal, sub] = await Promise.all([
        chatApiClient.getBalance(),
        chatApiClient.getSubscription(),
      ]);
      setBalance(bal);
      setSubscription(sub);
    } catch {
      // 游客模式可能会失败
    }
  };

  // 计算自定义金额对应的 credits
  const getCustomCredits = (amount: number): number => {
    return Math.floor(amount * 10); // ¥1 = 10 credits
  };

  // 处理充值
  const handleRecharge = async (paymentMethod: 'wechat' | 'alipay') => {
    let amount: number;
    let credits: number;

    if (selectedTier !== null) {
      const tier = RECHARGE_TIERS[selectedTier];
      amount = tier.amount;
      credits = tier.credits;
    } else if (customAmount) {
      amount = parseFloat(customAmount);
      if (isNaN(amount) || amount < 10) {
        alert('最低充值金额为 ¥10');
        return;
      }
      credits = getCustomCredits(amount);
    } else {
      alert('请选择充值档位或输入自定义金额');
      return;
    }

    setLoading(true);
    try {
      const result = await chatApiClient.createRechargeOrder({
        amount,
        credit_amount: credits,
        payment_method: paymentMethod,
      });
      navigate(`/payment/${result.order_no}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : '创建订单失败');
    } finally {
      setLoading(false);
    }
  };

  // 处理订阅
  const handleSubscribe = async (paymentMethod: 'wechat' | 'alipay') => {
    setLoading(true);
    try {
      const result = await chatApiClient.createSubscriptionOrder({
        plan_type: 'pro',
        payment_method: paymentMethod,
      });
      navigate(`/payment/${result.order_no}`);
    } catch (err) {
      alert(err instanceof Error ? err.message : '创建订单失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* 顶部导航 */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          <span>返回</span>
        </button>
      </div>

      {/* 标题区域 */}
      <div className="text-center mb-12 px-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-2xl mb-4">
          <Sparkles className="w-9 h-9 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-3">选择你的套餐</h1>
        <p className="text-gray-400 text-lg">
          选择最适合你的方案，释放 BioAgent 的全部潜力
        </p>
        {balance && (
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gray-800/50 border border-gray-700/50 text-gray-300 text-sm">
            <Zap size={14} className="text-amber-400" />
            当前余额: <span className="text-white font-semibold">{Number(balance.credit_balance).toLocaleString()} credits</span>
            {subscription && (
              <span className="ml-2 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
                Pro 生效中
              </span>
            )}
          </div>
        )}
      </div>

      {/* 三个定价卡片 */}
      <div className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">

          {/* ========== 基础版 ========== */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700/50 p-8 flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Zap size={20} className="text-blue-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">基础版</h2>
                <p className="text-sm text-gray-400">充多少用多少</p>
              </div>
            </div>

            <p className="text-gray-400 text-sm mb-6">
              按需充值 Credits，灵活使用各项分析功能
            </p>

            {/* 充值档位 */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {RECHARGE_TIERS.map((tier, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setSelectedTier(selectedTier === idx ? null : idx);
                    setCustomAmount('');
                  }}
                  className={`relative p-3 rounded-xl border text-center transition-all ${
                    selectedTier === idx
                      ? 'border-blue-500 bg-blue-500/10 text-white'
                      : 'border-gray-600/50 hover:border-gray-500 text-gray-300'
                  }`}
                >
                  <div className="text-lg font-bold">{tier.label}</div>
                  <div className="text-xs text-gray-400">{tier.credits.toLocaleString()} credits</div>
                  {tier.bonus && (
                    <div className="absolute -top-2 -right-2 px-1.5 py-0.5 rounded-full bg-amber-500 text-[10px] font-bold text-white">
                      {tier.bonus}
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* 自定义金额 */}
            <div className="mb-6">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">¥</span>
                <input
                  type="number"
                  min="10"
                  step="1"
                  placeholder="自定义金额 (最低¥10)"
                  value={customAmount}
                  onChange={(e) => {
                    setCustomAmount(e.target.value);
                    setSelectedTier(null);
                  }}
                  className="w-full pl-7 pr-4 py-2.5 rounded-xl bg-gray-700/50 border border-gray-600/50 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
              {customAmount && parseFloat(customAmount) >= 10 && (
                <div className="mt-1.5 text-xs text-gray-400">
                  约 {getCustomCredits(parseFloat(customAmount)).toLocaleString()} credits
                </div>
              )}
            </div>

            {/* 支付按钮 */}
            <div className="mt-auto space-y-2">
              <button
                onClick={() => handleRecharge('wechat')}
                disabled={loading || (!selectedTier && selectedTier !== 0 && !customAmount)}
                className="w-full py-3 rounded-xl bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium transition-colors flex items-center justify-center gap-2"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M8.69 11.29c.66 0 1.2-.53 1.2-1.18s-.54-1.18-1.2-1.18-1.2.53-1.2 1.18.54 1.18 1.2 1.18zm4.48-1.18c0 .65.54 1.18 1.2 1.18s1.2-.53 1.2-1.18-.54-1.18-1.2-1.18-1.2.53-1.2 1.18zM12 2C6.48 2 2 5.89 2 10.63c0 2.7 1.45 5.12 3.72 6.72-.1.36-.53 1.97-.62 2.3-.06.24.04.33.25.2.15-.1 2.3-1.52 3.23-2.14.72.12 1.47.19 2.24.19h.18c-.1-.52-.18-1.06-.18-1.62 0-4.08 3.58-7.39 8-7.39.25 0 .5.01.74.04C19.03 5.49 15.85 2 12 2zm8.18 7.89c-3.6 0-6.52 2.67-6.52 5.97s2.92 5.97 6.52 5.97c.62 0 1.22-.08 1.79-.22l2.37 1.57c.14.09.21.02.17-.14l-.45-1.67c1.84-1.3 3.04-3.27 3.04-5.51 0-3.3-2.92-5.97-6.52-5.97h-.4z"/></svg>
                微信支付
              </button>
              <button
                onClick={() => handleRecharge('alipay')}
                disabled={loading || (!selectedTier && selectedTier !== 0 && !customAmount)}
                className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium transition-colors flex items-center justify-center gap-2"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M21.422 15.358c-3.37-1.49-5.433-2.508-6.093-3.054a15.86 15.86 0 001.894-3.882h-4.6V7.2h5.62V6.2h-5.62V3.4h-1.93c-.26 0-.26.2-.26.2V6.2H5.013V7.2h5.42v1.222H5.673v1h7.27a12.794 12.794 0 01-1.34 2.676c-1.873-.658-3.828-.986-4.652-.362-1.236.936-.79 2.736.79 3.462 1.48.68 3.27.08 4.558-1.452.92.578 4.78 2.578 4.78 2.578L21.422 15.358zM8.54 14.846c-.89.686-2.18.934-3.01.466-.84-.466-.66-1.626.22-2.178.54-.34 1.29-.37 2.14-.08.86.29 1.46.73 1.88 1.14-.34.24-.74.44-1.23.652z"/></svg>
                支付宝
              </button>
            </div>
          </div>

          {/* ========== Pro 版（推荐）========== */}
          <div className="relative bg-gray-800/50 backdrop-blur-sm rounded-2xl border-2 border-emerald-500/50 p-8 flex flex-col shadow-lg shadow-emerald-500/5">
            {/* 推荐标签 */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-xs font-bold">
              推荐
            </div>

            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <Crown size={20} className="text-emerald-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Pro 版</h2>
                <p className="text-sm text-gray-400">专业级体验</p>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-baseline gap-1">
                <span className="text-4xl font-bold text-white">¥1,999</span>
                <span className="text-gray-400 text-sm">/月</span>
              </div>
            </div>

            {/* 特权列表 */}
            <ul className="space-y-3 mb-8 flex-1">
              {PRO_FEATURES.map((feature) => (
                <li key={feature} className="flex items-center gap-3 text-gray-300 text-sm">
                  <Check size={16} className="text-emerald-400 flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>

            {/* 订阅状态 / 支付按钮 */}
            {subscription ? (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center">
                <p className="text-emerald-400 font-medium mb-1">当前已订阅</p>
                <p className="text-gray-400 text-xs">
                  有效期至 {subscription.current_period_end}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={() => handleSubscribe('wechat')}
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 disabled:from-gray-700 disabled:to-gray-700 text-white font-medium transition-all flex items-center justify-center gap-2"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M8.69 11.29c.66 0 1.2-.53 1.2-1.18s-.54-1.18-1.2-1.18-1.2.53-1.2 1.18.54 1.18 1.2 1.18zm4.48-1.18c0 .65.54 1.18 1.2 1.18s1.2-.53 1.2-1.18-.54-1.18-1.2-1.18-1.2.53-1.2 1.18zM12 2C6.48 2 2 5.89 2 10.63c0 2.7 1.45 5.12 3.72 6.72-.1.36-.53 1.97-.62 2.3-.06.24.04.33.25.2.15-.1 2.3-1.52 3.23-2.14.72.12 1.47.19 2.24.19h.18c-.1-.52-.18-1.06-.18-1.62 0-4.08 3.58-7.39 8-7.39.25 0 .5.01.74.04C19.03 5.49 15.85 2 12 2zm8.18 7.89c-3.6 0-6.52 2.67-6.52 5.97s2.92 5.97 6.52 5.97c.62 0 1.22-.08 1.79-.22l2.37 1.57c.14.09.21.02.17-.14l-.45-1.67c1.84-1.3 3.04-3.27 3.04-5.51 0-3.3-2.92-5.97-6.52-5.97h-.4z"/></svg>
                  微信支付订阅
                </button>
                <button
                  onClick={() => handleSubscribe('alipay')}
                  disabled={loading}
                  className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 text-white font-medium transition-colors flex items-center justify-center gap-2"
                >
                  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current"><path d="M21.422 15.358c-3.37-1.49-5.433-2.508-6.093-3.054a15.86 15.86 0 001.894-3.882h-4.6V7.2h5.62V6.2h-5.62V3.4h-1.93c-.26 0-.26.2-.26.2V6.2H5.013V7.2h5.42v1.222H5.673v1h7.27a12.794 12.794 0 01-1.34 2.676c-1.873-.658-3.828-.986-4.652-.362-1.236.936-.79 2.736.79 3.462 1.48.68 3.27.08 4.558-1.452.92.578 4.78 2.578 4.78 2.578L21.422 15.358zM8.54 14.846c-.89.686-2.18.934-3.01.466-.84-.466-.66-1.626.22-2.178.54-.34 1.29-.37 2.14-.08.86.29 1.46.73 1.88 1.14-.34.24-.74.44-1.23.652z"/></svg>
                  支付宝订阅
                </button>
              </div>
            )}
          </div>

          {/* ========== 企业本地版 ========== */}
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700/50 p-8 flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Building2 size={20} className="text-purple-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">企业本地版</h2>
                <p className="text-sm text-gray-400">私有化部署</p>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-white">联系定价</span>
              </div>
              <p className="text-sm text-gray-400 mt-1">根据企业需求定制方案</p>
            </div>

            {/* 特权列表 */}
            <ul className="space-y-3 mb-8 flex-1">
              {ENTERPRISE_FEATURES.map((feature) => (
                <li key={feature} className="flex items-center gap-3 text-gray-300 text-sm">
                  <Check size={16} className="text-purple-400 flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>

            <button
              onClick={() => setShowContactModal(true)}
              className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors"
            >
              联系咨询
            </button>
          </div>
        </div>
      </div>

      {/* 企业版联系弹窗 */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 p-8 max-w-md w-full relative">
            <button
              onClick={() => setShowContactModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>

            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-500/20 rounded-xl mb-3">
                <Building2 size={24} className="text-purple-400" />
              </div>
              <h3 className="text-xl font-bold text-white">企业版咨询</h3>
              <p className="text-gray-400 text-sm mt-1">我们的团队将为您提供专属方案</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-700/50">
                <div className="text-gray-400 text-sm w-16 flex-shrink-0">邮箱</div>
                <div className="text-white text-sm font-medium">enterprise@bioagent.ai</div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-700/50">
                <div className="text-gray-400 text-sm w-16 flex-shrink-0">电话</div>
                <div className="text-white text-sm font-medium">400-XXX-XXXX</div>
              </div>
              <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-700/50">
                <div className="text-gray-400 text-sm w-16 flex-shrink-0">微信</div>
                <div className="text-white text-sm font-medium">BioAgent_Enterprise</div>
              </div>
            </div>

            <button
              onClick={() => setShowContactModal(false)}
              className="w-full mt-6 py-3 rounded-xl bg-gray-700 hover:bg-gray-600 text-white font-medium transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
