/**
 * ImageDisplay - 科研绘图结果展示组件
 * 
 * 显示生成的图片，支持放大、下载和查看源代码。
 */

import React, { useState } from 'react';

interface ImageDisplayProps {
  imageBase64: string;
  script?: string;
  format?: string;
}

const ImageDisplay: React.FC<ImageDisplayProps> = ({ imageBase64, script, format = 'png' }) => {
  const [showScript, setShowScript] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const imageSrc = `data:image/${format};base64,${imageBase64}`;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageSrc;
    link.download = `bioagent_plot_${Date.now()}.${format}`;
    link.click();
  };

  const handleCopyScript = () => {
    if (script) {
      navigator.clipboard.writeText(script);
    }
  };

  return (
    <div className="my-3">
      {/* Image container */}
      <div className="bg-white rounded-lg overflow-hidden border border-gray-600">
        <img
          src={imageSrc}
          alt="Generated Plot"
          className="w-full h-auto cursor-pointer"
          onClick={() => setIsFullScreen(true)}
        />
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-2 mt-2">
        <button
          onClick={handleDownload}
          className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded transition-colors"
          title="下载图片"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          下载
        </button>

        {script && (
          <button
            onClick={() => setShowScript(!showScript)}
            className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            {showScript ? '隐藏代码' : '查看代码'}
          </button>
        )}

        <button
          onClick={() => setIsFullScreen(true)}
          className="flex items-center gap-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded transition-colors"
          title="全屏查看"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
          放大
        </button>
      </div>

      {/* Script display */}
      {showScript && script && (
        <div className="mt-2 relative">
          <div className="bg-gray-900 rounded-lg p-3 border border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400">Python Script</span>
              <button
                onClick={handleCopyScript}
                className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
              >
                复制代码
              </button>
            </div>
            <pre className="text-xs text-gray-300 overflow-x-auto max-h-80 overflow-y-auto">
              <code>{script}</code>
            </pre>
          </div>
        </div>
      )}

      {/* Fullscreen overlay */}
      {isFullScreen && (
        <div
          className="fixed inset-0 z-50 bg-black bg-opacity-90 flex items-center justify-center"
          onClick={() => setIsFullScreen(false)}
        >
          <img
            src={imageSrc}
            alt="Generated Plot - Full Screen"
            className="max-w-[90vw] max-h-[90vh] object-contain"
          />
          <button
            onClick={() => setIsFullScreen(false)}
            className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
          >
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};

export default ImageDisplay;
