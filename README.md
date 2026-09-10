# 1688-angent · 构建归档

> 店雷达1688（Chatflow）+ 1688选品库（Workflow）的节点级 DSL / prompt / Code 全量记录

## 📑 在线预览

打开仓库首页后，根目录下 `docs/dify-1688-build-log/index.html` 是带 Tab 切换的完整归档页：

| Tab | 内容 |
| --- | --- |
| 总览 | 主 Chatflow 与下游 Workflow 的关系、职责划分 |
| 1688选品库 | 8 个节点的 id / 输入变量 / 输出变量 / 真实 prompt 与 Code |
| 店雷达1688 | Agent 节点完整字段、记忆配置、指令 v2 全文、工具声明 |
| 端到端回归 | 两轮对话真实 query、运行明细、DOM 渲染证据、校验清单 |
| 故障与修复 | 5 条按时间倒序的真实问题、原因、修复、教训 |

GitHub 在线阅读（直接渲染 HTML）：

- <https://github.com/kingf668877-creator/1688-angent/blob/docs/dify-1688-build-log/docs/dify-1688-build-log/index.html>

## 🗂️ 目录结构

```text
.
├── README.md                       # 本文件
└── docs/
    └── dify-1688-build-log/
        └── index.html              # 完整归档页（含 Tab 切换）
```

## 🔗 关联应用

| 角色 | 应用 | 文档链接 |
| --- | --- | --- |
| 主 Chatflow | 店雷达1688 (adba0a12…) | 发布版 #7（已验证 V2.9 10 列新版） |
| 下游 Workflow | 1688选品库 (9eb8746e…) | 发布版 **#91**（V2.9：商品转表格节点升级为 10 列可读版） |

> 完整变更日志：[CHANGELOG.md](./CHANGELOG.md)

## 📝 关键设计

1. 单轮完整原文透传到下游
2. 上下文追问由主 Chatflow 合并条件后传给下游
3. 下游 Workflow 保持无状态
4. 强制重新调用工具，禁止基于历史表格自行筛选

## 🔧 维护

- 分支：`docs/dify-1688-build-log`
- 本地工作目录：`F:\traehuihua\6a98eb4e8ba459dcb81b4ff1`
- 远端：`https://github.com/kingf668877-creator/1688-angent.git`
