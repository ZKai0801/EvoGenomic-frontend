import { ChatSession, Project, Message, AgentWorkStep } from '@/types';

// Generate unique ID
export const generateId = (): string => {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
};

// Mock projects data
export const mockProjects: Project[] = [
  {
    id: 'proj-1',
    name: 'RNA-Seq 分析项目',
    description: '肿瘤样本RNA测序数据分析',
    chats: [],
    createdAt: new Date('2026-01-15'),
    updatedAt: new Date('2026-01-20'),
  },
  {
    id: 'proj-2',
    name: '药物靶点预测',
    description: '基于机器学习的药物靶点预测',
    chats: [],
    createdAt: new Date('2026-01-10'),
    updatedAt: new Date('2026-01-18'),
  },
  {
    id: 'proj-3',
    name: '蛋白质结构分析',
    description: 'AlphaFold预测结果分析',
    chats: [],
    createdAt: new Date('2026-01-05'),
    updatedAt: new Date('2026-01-15'),
  },
];

// Mock chat history
export const mockChatHistory: ChatSession[] = [
  {
    id: 'chat-1',
    title: '如何进行差异表达分析',
    messages: [],
    createdAt: new Date('2026-01-20'),
    updatedAt: new Date('2026-01-20'),
  },
  {
    id: 'chat-2',
    title: 'KEGG通路富集分析',
    messages: [],
    createdAt: new Date('2026-01-19'),
    updatedAt: new Date('2026-01-19'),
  },
  {
    id: 'chat-3',
    title: '火山图绘制参数设置',
    messages: [],
    createdAt: new Date('2026-01-18'),
    updatedAt: new Date('2026-01-18'),
  },
  {
    id: 'chat-4',
    title: '生存分析方法选择',
    messages: [],
    createdAt: new Date('2026-01-17'),
    updatedAt: new Date('2026-01-17'),
  },
];

// Mock messages for demonstration
export const mockMessages: Message[] = [
  {
    id: 'msg-1',
    role: 'user',
    content: '请帮我分析这个RNA-Seq数据集，找出差异表达基因',
    timestamp: new Date('2026-01-20T10:00:00'),
  },
  {
    id: 'msg-2',
    role: 'assistant',
    content: '好的，我来帮您分析RNA-Seq数据集。首先，我需要了解一些基本信息：\n\n1. 您的数据是什么格式的？(FASTQ, BAM, counts matrix等)\n2. 有多少个样本？实验组和对照组各有多少？\n3. 您希望使用什么统计方法？(DESeq2, edgeR, limma等)\n\n请提供这些信息，我可以更好地帮助您进行分析。',
    timestamp: new Date('2026-01-20T10:00:30'),
  },
  {
    id: 'msg-3',
    role: 'user',
    content: '数据是counts matrix格式，共有6个样本，3个对照组和3个实验组。请使用DESeq2进行分析。',
    timestamp: new Date('2026-01-20T10:01:00'),
  },
  {
    id: 'msg-4',
    role: 'assistant',
    content: '明白了！我现在开始使用DESeq2进行差异表达分析。请稍等，我正在处理您的数据...',
    timestamp: new Date('2026-01-20T10:01:30'),
    isAgentWorking: true,
    agentWorkDetails: [
      {
        id: 'step-1',
        type: 'thinking',
        title: '分析任务规划',
        content: '用户需要使用DESeq2对6个样本的RNA-Seq counts数据进行差异表达分析。我需要：\n1. 读取counts矩阵\n2. 创建DESeq2对象\n3. 进行标准化和差异分析\n4. 筛选显著差异基因\n5. 生成结果报告',
        status: 'completed',
        timestamp: new Date('2026-01-20T10:01:35'),
      },
      {
        id: 'step-2',
        type: 'tool_call',
        title: '加载R包和数据',
        content: 'library(DESeq2)\nlibrary(tidyverse)\n\n# 读取counts矩阵\ncounts_data <- read.csv("counts_matrix.csv", row.names = 1)\n\n# 创建样本信息\ncoldata <- data.frame(\n  condition = factor(c(rep("control", 3), rep("treatment", 3)))\n)',
        status: 'completed',
        timestamp: new Date('2026-01-20T10:01:45'),
      },
      {
        id: 'step-3',
        type: 'tool_call',
        title: '创建DESeq2对象并运行分析',
        content: '# 创建DESeqDataSet对象\ndds <- DESeqDataSetFromMatrix(\n  countData = counts_data,\n  colData = coldata,\n  design = ~ condition\n)\n\n# 过滤低表达基因\ndds <- dds[rowSums(counts(dds)) >= 10, ]\n\n# 运行DESeq2分析\ndds <- DESeq(dds)',
        status: 'running',
        timestamp: new Date('2026-01-20T10:02:00'),
      },
    ],
  },
];

// Mock agent work steps
export const mockAgentWorkSteps: AgentWorkStep[] = [
  {
    id: 'step-1',
    type: 'thinking',
    title: '分析任务规划',
    content: '用户需要使用DESeq2对6个样本的RNA-Seq counts数据进行差异表达分析。我需要：\n1. 读取counts矩阵\n2. 创建DESeq2对象\n3. 进行标准化和差异分析\n4. 筛选显著差异基因\n5. 生成结果报告',
    status: 'completed',
    timestamp: new Date('2026-01-20T10:01:35'),
  },
  {
    id: 'step-2',
    type: 'tool_call',
    title: '加载R包和数据',
    content: 'library(DESeq2)\nlibrary(tidyverse)\n\n# 读取counts矩阵\ncounts_data <- read.csv("counts_matrix.csv", row.names = 1)\n\n# 创建样本信息\ncoldata <- data.frame(\n  condition = factor(c(rep("control", 3), rep("treatment", 3)))\n)',
    status: 'completed',
    timestamp: new Date('2026-01-20T10:01:45'),
  },
  {
    id: 'step-3',
    type: 'tool_call',
    title: '创建DESeq2对象并运行分析',
    content: '# 创建DESeqDataSet对象\ndds <- DESeqDataSetFromMatrix(\n  countData = counts_data,\n  colData = coldata,\n  design = ~ condition\n)\n\n# 过滤低表达基因\ndds <- dds[rowSums(counts(dds)) >= 10, ]\n\n# 运行DESeq2分析\ndds <- DESeq(dds)',
    status: 'running',
    timestamp: new Date('2026-01-20T10:02:00'),
  },
  {
    id: 'step-4',
    type: 'result',
    title: '提取差异表达结果',
    content: '# 提取结果\nres <- results(dds, contrast = c("condition", "treatment", "control"))\n\n# 按padj排序\nres_ordered <- res[order(res$padj), ]\n\n# 筛选显著差异基因 (padj < 0.05, |log2FC| > 1)\nsig_genes <- subset(res_ordered, padj < 0.05 & abs(log2FoldChange) > 1)',
    status: 'pending',
    timestamp: new Date('2026-01-20T10:02:30'),
  },
];
