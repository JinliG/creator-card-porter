# Creator Card Porter

**你的角色属于你。把它带走。**

Creator Card Porter 是一个免费开源的 Chrome 扩展，为 AI 情感陪伴平台上的创作者而做。一键抓取*你自己创建的*角色卡——人设、场景、开场白、示例对话、Lorebook 条目——导出为可移植、带版本号的 JSON 文件，方便你备份、迁移或导入到别处。

不需要账号，没有上传。在你主动清理之前，所有数据只留在你自己的浏览器里。

[English README → README.md](./README.md)

![Creator Card Porter 演示：从 JanitorAI 抓取角色并导出为 JSON](./images/demo.gif)

## 它是怎么工作的

1. **打开你的角色页面。** 在受支持的平台上打开你自己拥有的角色页或编辑器，等字段加载完成。
2. **点击「Capture current page」。** 扩展只在你点击的那一刻，读取当前标签页里已经加载好的字段，并缓存在本地。
3. **检查并导出。** 在弹窗里查看 **Preview**、**Mapping**、**JSON** 三个视图，确认无误后点 **Download JSON**，得到一个 `creator-card-porter.character-form-source` 文档，可用于备份或导入。

如果你的 JanitorAI 角色使用了 Lorebook，逐个打开关联的 Scripts 编辑页再各抓取一次——扩展会自动把抓到的所有 Script 合并进同一份导出。

## 你能得到什么

- **一份完整、可移植的快照。** 导出文件把原封不动的源数据（`source.*`）和映射后的目标表单（`form`）分开存放——即使目标平台没有对应字段，数据也不会丢。
- **透明的字段映射。** **Mapping** 视图逐条展示每个源字段流向哪个目标字段，无法映射的字段会被明确列出，而不是被悄悄丢弃。
- **本地优先的工具。** 抓取的数据保存在 `chrome.storage.local` 里，直到你主动点 **Clear captures** 或卸载扩展。没有开发者运营的服务器、没有统计、没有上传。

## 支持的平台

| 平台 | 状态 | 抓取内容 |
|---|---|---|
| **JanitorAI** | 已验证适配 | 角色字段 + Lorebook/Scripts 条目（最多 30 条 Playbook） |
| **其他平台** | 实验性 | 常见角色编辑器字段（名称、描述、人设、场景、开场白、示例对话、头像、标签）——尽力而为，导入前请检查 |

## 安装

本扩展以未打包的 Chrome MV3 扩展形式分发：

1. 打开 `chrome://extensions`。
2. 开启 **开发者模式**。
3. 选择 **加载已解压的扩展程序**，选中本仓库目录。
4. **Source platform** 保持 **JanitorAI**（在不支持的站点上可改选 **Other (experimental)**）。

带截图的完整安装流程、JanitorAI Lorebook 工作流和限制说明，见[中文使用指南](./user-guide/README.zh-CN.md)或 [English user guide](./user-guide/README.md)。

## 隐私边界

- 在你点击 **Capture current page** 之前，不会读取任何源页面。
- 只对当前选中的标签页使用临时 `activeTab` 权限；不声明任何常驻 host 权限，不安装常驻 content script 或后台 worker。
- 在角色或 Scripts 编辑页上，读取的是网站自己已注入编辑器的完整源状态。不复制登录令牌、不重放创作者专属请求、不拦截页面流量、不修改 `fetch`/`XMLHttpRequest`。
- 不抓取聊天记录、生成请求、Cookie、授权头、密码或 API key。
- 只在验证支持和识别角色/Scripts 编辑器时检查当前页 URL，URL 不会被留存。
- 所有映射和 JSON 生成都在浏览器本地完成。
- **Download capture diagnostics** 只在你明确确认后才导出抓取的请求/响应内容；该文件可能包含完整的私密角色定义，只应在有意为之的情况下分享。

完整的数据处理说明见 [PRIVACY.md](./PRIVACY.md)。

## 字段映射

### JanitorAI

| JanitorAI | 目标表单 |
|---|---|
| `name` | `basicInfo.name` |
| `description` | `basicInfo.bio`；开头文本派生 `basicInfo.hook` |
| `avatar` / `imageUrl` | `basicInfo.imageUrl` 和初始 `avatarUrl` |
| `tags` / `tagIds` | `basicInfo.tag` |
| `personality` | `characterSettings.persona` |
| `exampleDialogs` | 以 `<example_dialogs>` 追加到 Persona |
| `scenario` | `characterSettings.memorySeed` |
| `firstMessage` | `characterSettings.greeting` |
| Lorebook `script` JSON 条目 | `playbook[]` |
| 条目 `name` / `content` / `enabled` | Playbook 名称 / 正文 / 启用状态 |
| 条目关键词 | 自然语言的 Playbook 触发条件 |
| 条目 `constant: true` | Always On · Reminder |

Attributes、创作者附注和视觉序章在 JanitorAI 没有已验证的对应物，会在预览中显示为缺失字段。Script 的优先级和插入顺序没有直接的目标对应物。导出上限为 30 条 Playbook 条目。

### 其他平台（实验性）

| 常见源字段 | 目标表单 |
|---|---|
| name / character name | `basicInfo.name` |
| description / bio | `basicInfo.bio`；开头文本派生 `basicInfo.hook` |
| avatar / image | `basicInfo.imageUrl` 和初始 `avatarUrl` |
| tags | `basicInfo.tag` |
| personality / persona / definition | `characterSettings.persona` |
| example dialogs | 以 `<example_dialogs>` 追加到 Persona |
| scenario / context | `characterSettings.memorySeed` |
| first message / greeting | `characterSettings.greeting` |

无法识别的源字段会保留在 `source.character.data` 中并列入 `unmapped`，不会被悄悄丢弃。自定义富文本编辑器、canvas 编辑器、iframe、改过名的字段和动态隐藏的分区可能抓不到或映射错误——导入前务必检查 **Preview**、**Mapping**、**JSON**。

## JSON 契约

导出使用 `creator-card-porter.character-form-source` 版本 `2`，刻意将抓取的源数据与映射后的表单分开：

- `source.character.data` 完整保留从创作者页面读到的角色记录，包括没有目标映射的字段。
- `source.scripts[].data` 完整保留每个单独抓取的 Scripts 页面记录。重复抓取同一个 Script 会替换其缓存；抓取另一个 Script 会补充进集合。
- `form` 只包含映射到目标角色表单的值，包括最多 30 条 Playbook 条目。
- `mapping` 记录每个目标字段使用的确切 `source.*` 路径；`unmapped` 列出所有无法映射的抓取字段或条目。

当前导入器不支持版本 `1` 的导出文件。

## 抓取日志

打开创作者页面的 DevTools Console，过滤 `[Creator Card Porter]` 即可查看手动抓取的生命周期。日志包含页面类型、资源 ID、抓取策略、字段/条目数量、缓存写入和失败阶段。日志永远不会打印抓取的字段值、响应内容、Cookie、授权令牌或请求头。

## 开发

```bash
npm test       # 适配器与 manifest 规格测试
npm run check  # 语法检查 + 规格测试
```

## 自由软件与责任

Creator Card Porter 是由社区贡献维护的自由开源软件，按「现状」提供，不保证持续可用、兼容或无错误。它是一个独立工具；对所支持服务的引用仅为描述性的兼容标识，相关名称与商标归各自所有者所有。

你有责任确认自己有权处理所抓取的内容，遵守所使用各服务的规则，并在导入、发布或分享前检查和备份数据。在适用法律允许的范围内，维护者和贡献者不对因误用、服务政策变更、账号限制、数据丢失、兼容性问题或第三方纠纷产生的后果负责。

## 许可证

[MIT](./LICENSE)
