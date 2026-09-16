# Creator Card Porter · Brand Spec
> 采集日期：2026-09-15
> 资产来源：本仓库（icons/、popup/popup.css、manifest.json）
> 资产完整度：完整（自家产品，一手资产）

## 🎯 核心资产（一等公民）

### Logo
- 主版本：`icons/icon128.png`（紫→粉双卡片 + 箭头，128×128）
- 使用场景：demo 视频浏览器工具栏扩展图标、end card 主视觉
- 禁用变形：不拉伸、不改色、不加描边

### UI 参考
- 真实 popup UI：`popup/popup.html` + `popup/popup.css`（420×580，深色）
- demo 动画中的 popup 按此像素级复刻（仅整体缩放以适配 1080p 画布）

## 🎨 辅助资产

### 色板（全部 grep 自 popup/popup.css）
- Background: `#111016`（页面底）/ `#1c1a22`（控件底）/ `#17151b`（面板底）
- Ink: `#f7f5fb`（主文字）/ `#aa9fb1`（次文字）/ `#817986`（弱文字）
- Accent: `#e8548f`（品牌粉 · 主按钮、焦点、primary action）
- Success: `#7be0b4`（绿色 · captured/mapped 状态）
- Warning: `#f3c969`（琥珀 · 实验性/缺失提示）
- Border: `#3b3744` / `#302d37` / `#292630`

### 字型
- Display/UI: Inter（popup.css 指定）
- Mono（标签/代码/数据）: JetBrains Mono → ui-monospace → SFMono-Regular → Menlo

### 签名细节（120% 做到）
- popup 的三段式 tab（Preview / Mapping / JSON）与真实扩展一致
- 状态 pill 的圆角 999px + 边框半透明配色与真实扩展一致
- 鼠标轨迹为贝塞尔弧线 + 微抖动，点击有涟漪

### 禁区
- 不用紫色渐变背景（logo 内含紫→粉是资产本身，不作背景用）
- 不用 emoji 作图标
- 不用 CSS 剪影代替 logo（logo 用真实 PNG）

### 气质关键词
- 克制、工具感、深色精密、本地优先、创作者友好

### Demo 内容声明
- 演示中的 JanitorAI 角色 "Aveline" 为虚构示例内容，非真实用户数据
