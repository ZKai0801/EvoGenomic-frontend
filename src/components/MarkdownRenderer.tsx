import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check } from 'lucide-react';
import { useState, useCallback, useMemo, ReactNode } from 'react';
import 'katex/dist/katex.min.css';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

/**
 * 预处理 Markdown 内容，将 LLM 常用的 LaTeX 分隔符转换为 remark-math 支持的格式
 * \(...\) → $...$  (行内公式)
 * \[...\] → $$...$$ (块级公式)
 */
function preprocessLaTeX(content: string): string {
  // 先保护代码块内容不被替换
  const codeBlocks: string[] = [];
  let processed = content.replace(/```[\s\S]*?```|`[^`\n]+`/g, (match) => {
    codeBlocks.push(match);
    return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
  });

  // 块级公式: \[...\] → $$...$$（可跨行）
  processed = processed.replace(/\\\[([\s\S]*?)\\\]/g, (_match, p1) => `$$${p1}$$`);

  // 行内公式: \(...\) → $...$（不跨行）
  processed = processed.replace(/\\\((.*?)\\\)/g, (_match, p1) => `$${p1}$`);

  // 恢复代码块
  processed = processed.replace(/__CODE_BLOCK_(\d+)__/g, (_match, idx) => codeBlocks[Number(idx)]);

  return processed;
}

// 代码块组件
function CodeBlock({ 
  language, 
  children 
}: { 
  language: string | undefined; 
  children: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [children]);

  return (
    <div className="relative group my-3">
      <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={handleCopy}
          className="p-1.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 hover:text-white transition-colors"
          title={copied ? '已复制' : '复制代码'}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
      {language && (
        <div className="absolute left-3 top-0 -translate-y-1/2 px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-300">
          {language}
        </div>
      )}
      <SyntaxHighlighter
        style={oneDark}
        language={language || 'text'}
        PreTag="div"
        className="rounded-lg !mt-0 !mb-0"
        customStyle={{
          margin: 0,
          padding: '1rem',
          paddingTop: language ? '1.5rem' : '1rem',
          fontSize: '0.875rem',
          lineHeight: '1.5',
        }}
      >
        {children}
      </SyntaxHighlighter>
    </div>
  );
}

export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  const processedContent = useMemo(() => preprocessLaTeX(content), [content]);

  return (
    <div className={`markdown-content prose prose-sm max-w-none ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          // 代码块
          code({ inline, className: codeClassName, children, ...props }: { inline?: boolean; className?: string; children?: ReactNode }) {
            const match = /language-(\w+)/.exec(codeClassName || '');
            const language = match ? match[1] : undefined;
            const codeString = String(children).replace(/\n$/, '');

          if (!inline && (match || codeString.includes('\n'))) {
            return <CodeBlock language={language}>{codeString}</CodeBlock>;
          }

          // 行内代码
          return (
            <code
              className="px-1.5 py-0.5 bg-rosegold-50 text-rosegold-500 rounded text-sm font-mono"
              {...props}
            >
              {children}
            </code>
          );
        },
        // 段落
        p({ children }: { children?: ReactNode }) {
          return <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>;
        },
        // 标题
        h1({ children }: { children?: ReactNode }) {
          return <h1 className="text-xl font-bold mb-3 mt-4 first:mt-0">{children}</h1>;
        },
        h2({ children }: { children?: ReactNode }) {
          return <h2 className="text-lg font-bold mb-2 mt-3 first:mt-0">{children}</h2>;
        },
        h3({ children }: { children?: ReactNode }) {
          return <h3 className="text-base font-bold mb-2 mt-3 first:mt-0">{children}</h3>;
        },
        // 列表
        ul({ children }: { children?: ReactNode }) {
          return <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>;
        },
        ol({ children }: { children?: ReactNode }) {
          return <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>;
        },
        li({ children }: { children?: ReactNode }) {
          return <li className="leading-relaxed">{children}</li>;
        },
        // 链接
        a({ href, children }: { href?: string; children?: ReactNode }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-rosegold-500 hover:text-rosegold-600 underline underline-offset-2"
            >
              {children}
            </a>
          );
        },
        // 引用块
        blockquote({ children }: { children?: ReactNode }) {
          return (
            <blockquote className="border-l-4 border-rosegold-300 pl-4 py-1 my-3 bg-rosegold-50 rounded-r italic text-text-secondary">
              {children}
            </blockquote>
          );
        },
        // 表格
        table({ children }: { children?: ReactNode }) {
          return (
            <div className="overflow-x-auto my-3">
              <table className="min-w-full border-collapse border border-platinum-400 rounded">
                {children}
              </table>
            </div>
          );
        },
        thead({ children }: { children?: ReactNode }) {
          return <thead className="bg-platinum-200">{children}</thead>;
        },
        th({ children }: { children?: ReactNode }) {
          return (
            <th className="border border-platinum-400 px-3 py-2 text-left font-semibold">
              {children}
            </th>
          );
        },
        td({ children }: { children?: ReactNode }) {
          return <td className="border border-platinum-400 px-3 py-2">{children}</td>;
        },
        // 分隔线
        hr() {
          return <hr className="my-4 border-platinum-400" />;
        },
        // 加粗
        strong({ children }: { children?: ReactNode }) {
          return <strong className="font-semibold">{children}</strong>;
        },
        // 斜体
        em({ children }: { children?: ReactNode }) {
          return <em className="italic">{children}</em>;
        },
        // 删除线
        del({ children }: { children?: ReactNode }) {
          return <del className="line-through text-gray-500">{children}</del>;
        },
        // 图片
        img({ src, alt }: { src?: string; alt?: string }) {
          return (
            <img
              src={src}
              alt={alt}
              className="max-w-full h-auto rounded-lg my-3"
            />
          );
        },
      }}
    >
      {processedContent}
    </ReactMarkdown>
    </div>
  );
}
