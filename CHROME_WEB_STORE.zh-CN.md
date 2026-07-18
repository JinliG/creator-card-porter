# Chrome Web Store 上架清单

## 提交前

- 将本仓库公开，或至少准备一个公开的产品说明 / 支持页面。
- 把 `PRIVACY.md` 发布为无需登录即可访问的网页，并将网址填入商店后台。
- 准备 1280 × 800 或 640 × 400 的真实操作截图。
- 使用 `dist/creator-card-porter-0.5.2.zip` 上传，确认 ZIP 第一层能直接看到 `manifest.json`。
- 第一次建议选择 Unlisted 或 Private，实际验证后再转 Public。

插件内置的 `Privacy & data use` 页面方便用户查看，但商店后台仍需填写一个公开的外部隐私政策网址。

## 单一用途

推荐填写：

> Help creators manually capture their own character and Lorebook definitions from the current tab, preview the field mapping, and export a portable JSON file.

## 权限说明

### activeTab

> Used only after the user clicks Capture current page, so the extension can identify and read the currently selected creator page. Access is temporary and limited to that tab.

### scripting

> Injects the capture helper into the active tab only after an explicit user action. The extension has no always-on content script and does not intercept general browsing traffic.

### storage

> Stores complete user-selected character or Lorebook sources locally so the user can combine them, review the mapping, and export one JSON file. The extension reports a visible error if the browser cannot store a complete capture. The user can clear the data at any time.

## 隐私披露建议

后台数据类型如实勾选：

- Website content：角色和 Lorebook 的正文、设置、图片地址。

不勾选 Web history：插件只在用户点击抓取后检查当前标签页 URL，用于确认页面类型和资源 ID；不会读取或保存浏览记录，也不会保留该 URL。JanitorAI 模式读取编辑器已经加载的角色或 Scripts 状态，不读取授权令牌，也不重放私有接口。Other 实验模式只读取当前页可识别的原生表单控件，不猜测或探测未知站点的接口。

用途仅选择“提供插件核心功能”。不要勾选广告、画像、分析或出售数据。确认：

- 数据只在浏览器本地处理和保存。
- 不会自动上传或共享。
- 只在用户点击抓取后读取当前页。
- 用户可通过 `Clear captures` 删除数据。

## 商店文案

短描述：

> Capture creator-owned character data and export a portable form-source JSON file.

详细描述：

> Creator Card Porter helps creators move their own character definitions through a portable JSON workflow. Use the verified JanitorAI adapter or try the experimental Other form reader, choose Capture current page, review the source and standard-template mapping, and export the combined file. Capture is manual, processing stays in the browser, and stored sources can be cleared at any time.

开源说明：

> Creator Card Porter is an independent open-source utility maintained through community contributions. Platform names are used only as descriptive compatibility labels; names and marks remain with their respective owners.

## 审核测试说明

1. 登录测试账号并打开一个角色编辑页。
2. 点击插件图标，再点击 `Capture current page`。
3. 确认 Preview 和 JSON 出现角色字段。
4. 打开对应的 Scripts 编辑页，再次点击抓取。
5. 确认原角色缓存仍在，并出现 `N Playbook`。
6. 点击 `Clear captures`，确认本地结果被删除。

Other 实验模式可另外测试：在普通角色编辑表单上选择 `Other (experimental)`，确认警告始终可见；点击抓取后检查 Preview 保留源字段、Mapping 只展示标准模板映射。此模式允许因自定义编辑器而明确提示抓取失败。

如果审核必须使用登录账号，单独在后台的测试说明中提供；不要写进公开仓库或截图。
