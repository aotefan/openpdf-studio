# Contributing / 参与贡献

欢迎帮助完善免费 PDF 编辑器。优先任务：安全运行时升级、字体/排版保真、复杂 PDF 转换、中文与英文交互、大文档性能。

1. 先阅读 [功能限制](docs/features.md) 和 [安全运行时状态](docs/runtime-security.md)。
2. 报告问题请写明 macOS/CPU、项目版本、操作步骤、期望与实际结果；只附自制或脱敏 PDF。
3. 新功能遵循最小步骤：可撤销操作尽量直接执行；批量破坏性变更先给变更摘要；失败保留原文档。
4. 所有界面文案进入 `src/i18n/zh-CN.json` 与 `en-US.json`，新增功能同时覆盖两种菜单语言。
5. 改动 PDF 引擎需验证内容、保存重开及未涉及区域；视觉相似不等于 PDF 结构正确。
6. 提交前运行适用测试。`npm run test:ui` 要求已验证修补后的 Electron；受阻时明确记录，不填写虚假 PASS。

提交代码须为自己有权贡献的独立实现，并接受本项目 AGPL-3.0-or-later 许可。不提交 WPS 二进制、反编译输出、专有图标、破解补丁、个人 PDF、API Key 或本机配置。

没有另外的 CLA。请在 PR 中说明问题、行为变化、测试结果和已知边界。This project welcomes issues, documentation, translations and independently authored patches under AGPL-3.0-or-later.
