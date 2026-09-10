# CHANGELOG

记录 1688 选品库 / 店雷达1688 系统的版本演进。

## V2.9 · 2026-09-10

### 升级目标

把下游 `1688选品库` Workflow 的 “商品转表格” Python 节点从 9 列压缩版升级为 10 列可读版，
让 Chatflow “店雷达1688” 用户能够看到完整业务字段、商品详情链接与店铺入口的分离。

### 关键改动

| 项 | 旧 | 新 |
| --- | --- | --- |
| 下游 Workflow 1688选品库 | 发布版 `#87` | 发布版 **`#91`** |
| 工作流作为工具 1688selector | `synced=false` | **`synced=true`** |
| Chatflow 店雷达1688 | 旧 9 列压缩表 | **新版 10 列可读表** |
| 改动节点 | — | `商品转表格`（节点 ID `1788839166239`） |
| 代码长度 | 2606 字符 | **5424 字符** |

### 表头变更

旧（9 列）：
`主图 / 标题 / 价格 / 起订 / 销量 / 发货 / 地区 / 公司 / 类目`

新（10 列）：
`商品 / 价格 / 采购 / 上架时间 / 近30天数据 / 复购率 / 供应商 / 所在地 / 保障 / 实力 / 类目 / 链接`

### 字段映射

| 表头 | 数据来源 | 备注 |
| --- | --- | --- |
| 商品 | `image` + `title` + `offerId` + `shopId` | 标题与图片均链接 `https://detail.1688.com/offer/{offerId}.html` |
| 价格 | `quantityPrices` + `price` + `consignPrice` | 含阶梯价、单价、**代发价** |
| 采购 | `quantityBegin` + `unit` + `deliveryTime` | 起订 + 发货时间 |
| 上架时间 | `offerCreateTime` | 格式化为 `YYYY-MM-DD HH:mm` |
| 近 30 天数据 | `saleQuantity` + `orderCount` + `salesVolume` | 件数 / 笔数 / 销售额 |
| 复购率 | `extraMap.positiveRate` → `buyerRate` → `positiveRate` | 三级回退，空则显示 `-` |
| 供应商 | `company` + `companyType` + `tpYear` | 公司名 / 店铺或工厂 / TP 年限 |
| 所在地 | `province` + `city` | 拼接为 `广东 东莞` 形式 |
| 保障 / 实力 | `buyerProtections` + `shiLiType` | 用 ` · ` 拼接 |
| 类目 / 链接 | `levelName` + `shopUrl` | **进入店铺** 仅跳 `shopUrl`，不跳详情 |

### 链接分离规则

- 商品图片、商品标题 → `https://detail.1688.com/offer/{offerId}.html`
- “进入店铺” → `item.shopUrl`（形如 `https://shop24k7738465666.1688.com/`）

### 端到端验证

1. 工作流“测试运行”直接跑新版代码节点：
   - 输入：`近30天上架的价格小于10元的连衣裙`
   - 输出：30 条商品，10 列表头全部齐全，链接目标与上方规则一致。
2. 工作流作为工具同步：通过 `POST /console/api/workspaces/current/tool-provider/workflow/update`
   把 `workflow_tool_id=85e2a0d0-…` 重新同步后，`synced=true`。
3. Chatflow “店雷达1688” 开启新会话再次查询：表头立即变为新版 10 列。

### 发布动作

- 下游 Workflow 发布：`2026-09-10 21:35` → `已发布 #91 · 几秒前`
- 工具同步：`2026-09-10 21:38` → `synced=true`
- Chatflow 验证：`2026-09-10 21:39+`

### 故障留痕（已解决）

- **键盘粘贴失败**：浏览器层 `Ctrl+V` 在 Monaco 中不生效，改用
  `window.monaco.editor.getModels()[0].setValue()` 直接写入。
- **Monaco textarea 为空**：失焦后文本缓冲会被清空，需用 `model.getValue()` 或
  Dify 草稿 API 验证。
- **Shell 输出被截断**：大段源码通过 Base64 分段传输，再在页内 `atob` 还原。
- **新版字段 `offer=false` 误判**：草稿 JSON 序列化后静态匹配不连续，但其余特征
  (`positiveRate` / `consignPrice` / `province` / `len(products)`) 均命中，写入成功。
- **Chatflow 仍显示旧表**：工具发布后未触发同步；通过 `tool-provider/workflow/update`
  显式同步后正常。

---

## V2.8 · 2026-09-09 及更早

占位。历史快照见 `docs/dify-1688-build-log/index.html` 中的“故障与修复”Tab。
