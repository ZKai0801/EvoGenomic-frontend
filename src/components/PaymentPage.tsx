/**
 * 支付页面 - 展示二维码 / 支付链接，轮询订单状态
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { chatApiClient } from '@/api';
import type { OrderResponse } from '@/api/types';

export function PaymentPage() {
  const navigate = useNavigate();
  const { orderNo } = useParams<{ orderNo: string }>();
  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [paymentUrl, setPaymentUrl] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 加载订单信息
  useEffect(() => {
    if (!orderNo) return;
    loadOrder();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [orderNo]);

  const loadOrder = async () => {
    try {
      const data = await chatApiClient.getOrderStatus(orderNo!);
      setOrder(data);

      // 从 sessionStorage 中获取支付 URL（由 UpgradePage 跳转前存储）
      const stored = sessionStorage.getItem(`payment_${orderNo}`);
      if (stored) {
        const paymentData = JSON.parse(stored);
        setPaymentUrl(paymentData.code_url || paymentData.pay_url || '');
      }

      // 计算倒计时
      if (data.status === 'pending') {
        const expiredAt = new Date(data.expired_at).getTime();
        const now = Date.now();
        const remaining = Math.max(0, Math.floor((expiredAt - now) / 1000));
        setCountdown(remaining);
        startCountdown(remaining);
        startPolling();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载订单失败');
    }
  };

  const startCountdown = (seconds: number) => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    let remaining = seconds;
    countdownRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        if (countdownRef.current) clearInterval(countdownRef.current);
        setCountdown(0);
        // 过期时停止轮询
        if (pollRef.current) clearInterval(pollRef.current);
        // 重新加载订单获取最新状态
        if (orderNo) chatApiClient.getOrderStatus(orderNo).then(setOrder).catch(() => {});
      } else {
        setCountdown(remaining);
      }
    }, 1000);
  };

  const startPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const data = await chatApiClient.getOrderStatus(orderNo!);
        setOrder(data);
        if (data.status !== 'pending') {
          // 支付完成或已过期，停止轮询
          if (pollRef.current) clearInterval(pollRef.current);
          if (countdownRef.current) clearInterval(countdownRef.current);
          // 支付成功，3秒后跳转
          if (data.status === 'paid') {
            setTimeout(() => navigate('/'), 3000);
          }
        }
      } catch {
        // 轮询出错不处理
      }
    }, 3000);
  }, [orderNo, navigate]);

  const formatCountdown = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const getOrderTypeLabel = () => {
    if (!order) return '';
    if (order.order_type === 'recharge') {
      return `充值 ${order.credit_amount?.toLocaleString()} Credits`;
    }
    return `Pro 版月度订阅`;
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <XCircle size={48} className="text-red-400 mx-auto mb-4" />
          <p className="text-white text-lg mb-4">{error}</p>
          <button
            onClick={() => navigate('/upgrade')}
            className="px-6 py-2 rounded-xl bg-gray-700 hover:bg-gray-600 text-white transition-colors"
          >
            返回升级页
          </button>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <Loader2 size={32} className="text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* 顶部导航 */}
      <div className="max-w-2xl mx-auto px-6 py-6">
        <button
          onClick={() => navigate('/upgrade')}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          <span>返回</span>
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-6 pb-20">
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl border border-gray-700/50 p-8">

          {/* 支付成功 */}
          {order.status === 'paid' && (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/20 mb-6">
                <CheckCircle2 size={40} className="text-emerald-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">支付成功！</h2>
              <p className="text-gray-400 mb-2">{getOrderTypeLabel()}</p>
              <p className="text-gray-500 text-sm">3 秒后自动跳转至主页…</p>
            </div>
          )}

          {/* 订单过期 / 取消 */}
          {(order.status === 'expired' || order.status === 'cancelled') && (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-red-500/20 mb-6">
                <XCircle size={40} className="text-red-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                {order.status === 'expired' ? '订单已过期' : '订单已取消'}
              </h2>
              <p className="text-gray-400 mb-6">请重新创建订单</p>
              <button
                onClick={() => navigate('/upgrade')}
                className="px-8 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
              >
                重新选择套餐
              </button>
            </div>
          )}

          {/* 待支付 */}
          {order.status === 'pending' && (
            <>
              {/* 订单信息 */}
              <div className="mb-8">
                <h2 className="text-xl font-bold text-white mb-4">订单确认</h2>
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">套餐</span>
                    <span className="text-white">{getOrderTypeLabel()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">订单号</span>
                    <span className="text-gray-300 font-mono text-xs">{order.order_no}</span>
                  </div>
                  <div className="h-px bg-gray-700 my-2" />
                  <div className="flex justify-between">
                    <span className="text-gray-400">应付金额</span>
                    <span className="text-2xl font-bold text-white">
                      ¥{Number(order.amount).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 支付方式标识 */}
              <div className="mb-6 flex items-center gap-2 text-sm text-gray-400">
                {order.payment_method === 'wechat' ? (
                  <>
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-green-500"><path d="M8.69 11.29c.66 0 1.2-.53 1.2-1.18s-.54-1.18-1.2-1.18-1.2.53-1.2 1.18.54 1.18 1.2 1.18zm4.48-1.18c0 .65.54 1.18 1.2 1.18s1.2-.53 1.2-1.18-.54-1.18-1.2-1.18-1.2.53-1.2 1.18zM12 2C6.48 2 2 5.89 2 10.63c0 2.7 1.45 5.12 3.72 6.72-.1.36-.53 1.97-.62 2.3-.06.24.04.33.25.2.15-.1 2.3-1.52 3.23-2.14.72.12 1.47.19 2.24.19h.18c-.1-.52-.18-1.06-.18-1.62 0-4.08 3.58-7.39 8-7.39.25 0 .5.01.74.04C19.03 5.49 15.85 2 12 2zm8.18 7.89c-3.6 0-6.52 2.67-6.52 5.97s2.92 5.97 6.52 5.97c.62 0 1.22-.08 1.79-.22l2.37 1.57c.14.09.21.02.17-.14l-.45-1.67c1.84-1.3 3.04-3.27 3.04-5.51 0-3.3-2.92-5.97-6.52-5.97h-.4z"/></svg>
                    <span>微信支付 — 请使用微信扫描下方二维码</span>
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-blue-500"><path d="M21.422 15.358c-3.37-1.49-5.433-2.508-6.093-3.054a15.86 15.86 0 001.894-3.882h-4.6V7.2h5.62V6.2h-5.62V3.4h-1.93c-.26 0-.26.2-.26.2V6.2H5.013V7.2h5.42v1.222H5.673v1h7.27a12.794 12.794 0 01-1.34 2.676c-1.873-.658-3.828-.986-4.652-.362-1.236.936-.79 2.736.79 3.462 1.48.68 3.27.08 4.558-1.452.92.578 4.78 2.578 4.78 2.578L21.422 15.358zM8.54 14.846c-.89.686-2.18.934-3.01.466-.84-.466-.66-1.626.22-2.178.54-.34 1.29-.37 2.14-.08.86.29 1.46.73 1.88 1.14-.34.24-.74.44-1.23.652z"/></svg>
                    <span>支付宝</span>
                  </>
                )}
              </div>

              {/* 二维码 / 跳转链接 */}
              <div className="flex flex-col items-center mb-6">
                {order.payment_method === 'wechat' && paymentUrl ? (
                  <div className="p-4 bg-white rounded-2xl">
                    <QRCodeSVG
                      value={paymentUrl}
                      size={200}
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                ) : order.payment_method === 'alipay' && paymentUrl ? (
                  <div className="text-center">
                    <p className="text-gray-400 text-sm mb-4">点击下方按钮跳转至支付宝完成支付</p>
                    <a
                      href={paymentUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors"
                    >
                      打开支付宝
                    </a>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Loader2 size={32} className="text-gray-400 animate-spin mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">正在获取支付信息…</p>
                  </div>
                )}
              </div>

              {/* 倒计时 */}
              <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                <Clock size={14} />
                <span>
                  请在 <span className="text-white font-mono font-medium">{formatCountdown(countdown)}</span> 内完成支付
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
