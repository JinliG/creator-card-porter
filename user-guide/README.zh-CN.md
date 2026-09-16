# Creator Card Porter 使用说明

[English User Guide](./README.md)

## 1. 这是什么？

Creator Card Porter 是一个角色卡搬运插件。

它会读取你在来源平台上有权管理的角色和 Lorebook，整理成一份 JSON 文件，你可以留作备份，或导入任何支持该格式的工具。

插件只负责读取、预览和导出，不会自动发布角色。

这是一个由社区贡献维护的独立开源工具。文档中的平台名称只用于说明兼容范围，相关名称和标识归各自权利方所有。

## 2. 适用情况

- 建议使用**桌面版 Google Chrome**。
- 使用前需要登录来源平台账号。
- 只能搬运自己创作或明确有权管理的角色内容。
- Janitor 角色主体和 Lorebook 需要分别抓取，再由插件拼在一起。
- 其他平台可尝试 `Other (experimental)` 通用抓取，但结果必须手动检查。

## 3. 怎么用？

### 第一步：安装插件

1. 解压插件 ZIP 文件。
2. 在 Chrome 地址栏打开：

   ```text
   chrome://extensions
   ```

3. 打开右上角“开发者模式”。
4. 点击“加载已解压的扩展程序”。
5. 选择刚才解压的文件夹。该文件夹第一层应该能看到 `manifest.json`。
6. 在 Chrome 的拼图菜单中固定 `Creator Card Porter`。

![01-install-extension](../images/01-install-extension.png)

### 第二步：抓取角色主体

1. 在 Chrome 中登录你的 JanitorAI 创作者账号。
2. 打开角色编辑页：

   ```text
   https://janitorai.com/edit_character/角色UUID
   ```

3. 点击插件图标。
4. 如果要开始搬一张新卡，先点击 `Clear captures` 清空上一张卡。
5. 点击 `Capture current page`。
6. 看到角色名称和 `Ready`，说明角色主体抓取成功。

插件不会在后台自动读取页面。只有点击 `Capture current page` 时，它才会读取当前标签页，并把结果保存在本机浏览器中。

![02-capture-character](../images/02-install-extension.png)

### 使用 Other（实验性）

1. 在插件的 `Source platform` 中选择 `Other (experimental)`。
2. 打开来源平台的角色编辑页，等表单加载完成，并展开需要抓取的折叠区域。
3. 点击 `Capture current page`。
4. 在 `Preview`、`Mapping` 和 `JSON` 中检查结果，再下载导入。

插件会尝试识别名称、简介、人设、场景、开场白、示例对话、头像和标签等常见表单字段。这个模式是实验功能，页面使用自定义富文本编辑器、iframe、Canvas、特殊字段名或隐藏区域时，可能抓不到或映射错误。它不会自动寻找单独的 Lorebook，也不会猜测未知平台的接口。

### 第三步：抓取 Lorebook / Scripts

如果角色使用了 Lorebook：

1. **不要点击 `Clear captures`**。
2. 打开对应的 Scripts 编辑页：

   ```text
   https://janitorai.com/scripts/脚本UUID/edit
   ```

3. 点击插件图标。
4. 点击 `Capture current page`。
5. 重新打开插件，看到类似 `角色名 · 2 Playbook`，说明已经拼接成功。
6. 有多个 Scripts 时，依次打开并重复抓取。

![03-install-extension](../images/03-install-extension.png)

### 第四步：检查并导出 JSON

> :beer: 导出的内容中包含了平台原始的信息

1. 在 `Preview` 中检查实际抓到的角色字段和 Scripts 来源。
2. 切换到 `Mapping`，检查这些来源字段如何映射到标准角色信息模板。
3. 可以切换到 `JSON` 查看完整文件。
4. 点击 `Download JSON` 下载。

----

### 可选：导入其他工具

导出的 JSON 遵循仓库 README 中说明的 `creator-card-porter.character-form-source` 格式。你可以把它留作备份、手动编辑，或交给任何理解该格式的导入工具。无论导入到哪里，保存或发布前都请先检查映射后的字段。

## 最容易弄错的三件事

1. **角色页切到 Scripts 页时不要清缓存。**插件需要把角色主体和 Playbook 拼在一起。
2. **准备搬另一个角色时一定要先清缓存。**否则上一张卡的 Playbook 可能被拼到新角色中。
3. **Other 的结果一定要检查。**它只是按常见字段名识别表单，成功抓取不代表所有字段都正确。

## 免费与使用责任

本项目是按 MIT License 开放源代码的免费软件，由社区共同维护，并按现状提供。我们会尽力改进，但不承诺插件始终可用、始终兼容所有页面，或导出结果完全没有错误。

请只处理自己创作或明确获得授权的内容，自行遵守所使用平台的规则，并在导入、发布或分享前检查和备份数据。

同时，所有信息提取不会走任何外部网络，且保存在用户本地，因误用、平台规则变化、账号限制、数据丢失、兼容问题或第三方争议产生的后果，由使用者自行判断和承担；在法律允许的范围内，维护者和贡献者不对此承担责任。
