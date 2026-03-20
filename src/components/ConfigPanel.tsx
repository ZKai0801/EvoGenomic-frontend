/**
 * ConfigPanel - MCP 配置确认面板
 * 
 * 当 ML建模 或 生信流程 通过 MCP 生成配置后，
 * 展示配置详情供用户确认/修改后再执行。
 */

import React, { useState } from 'react';
import { McpConfig } from '../types';

interface ConfigPanelProps {
  config: McpConfig;
  onConfirm: (modifiedConfig: Record<string, any>) => void;
  onCancel: () => void;
}

const ConfigPanel: React.FC<ConfigPanelProps> = ({ config, onConfirm, onCancel }) => {
  const [editableConfig, setEditableConfig] = useState<Record<string, any>>(
    JSON.parse(JSON.stringify(config.config))
  );
  const [isExpanded, setIsExpanded] = useState(true);

  const handleFieldChange = (key: string, value: any) => {
    setEditableConfig(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const renderField = (key: string, value: any) => {
    if (typeof value === 'boolean') {
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={value}
            onChange={(e) => handleFieldChange(key, e.target.checked)}
            className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-300">{value ? '是' : '否'}</span>
        </label>
      );
    }

    if (typeof value === 'number') {
      return (
        <input
          type="number"
          value={value}
          onChange={(e) => handleFieldChange(key, Number(e.target.value))}
          className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-gray-200 focus:outline-none focus:border-blue-500"
        />
      );
    }

    if (Array.isArray(value)) {
      return (
        <textarea
          value={JSON.stringify(value, null, 2)}
          onChange={(e) => {
            try {
              handleFieldChange(key, JSON.parse(e.target.value));
            } catch {
              // 解析失败时不更新
            }
          }}
          rows={3}
          className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-gray-200 font-mono focus:outline-none focus:border-blue-500"
        />
      );
    }

    if (typeof value === 'object' && value !== null) {
      return (
        <textarea
          value={JSON.stringify(value, null, 2)}
          onChange={(e) => {
            try {
              handleFieldChange(key, JSON.parse(e.target.value));
            } catch {
              // 解析失败时不更新
            }
          }}
          rows={4}
          className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-gray-200 font-mono focus:outline-none focus:border-blue-500"
        />
      );
    }

    return (
      <input
        type="text"
        value={String(value)}
        onChange={(e) => handleFieldChange(key, e.target.value)}
        className="w-full px-3 py-1.5 bg-gray-700 border border-gray-600 rounded text-sm text-gray-200 focus:outline-none focus:border-blue-500"
      />
    );
  };

  return (
    <div className="my-3 bg-gray-800 border border-gray-600 rounded-lg overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-gray-750 cursor-pointer hover:bg-gray-700 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-yellow-400 text-lg">⚙️</span>
          <span className="text-sm font-medium text-gray-200">
            配置确认 - {config.tool}
          </span>
          <span className="text-xs text-gray-400 bg-gray-700 px-2 py-0.5 rounded">
            {config.server}
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Body */}
      {isExpanded && (
        <div className="px-4 py-3 space-y-3">
          {config.description && (
            <p className="text-sm text-gray-400 mb-3">{config.description}</p>
          )}

          {/* Config fields */}
          <div className="space-y-3">
            {Object.entries(editableConfig).map(([key, value]) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-400 mb-1">
                  {key}
                </label>
                {renderField(key, value)}
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-3 border-t border-gray-700">
            <button
              onClick={() => onConfirm(editableConfig)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded transition-colors"
            >
              确认执行
            </button>
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-sm font-medium rounded transition-colors"
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ConfigPanel;
