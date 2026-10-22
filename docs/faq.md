# 免费 PDF 编辑器常见问题 — OpenPDF Studio

## OpenPDF Studio 是什么？

OpenPDF Studio 是一款面向 macOS Apple Silicon 的免费开源 PDF 编辑器。界面以中文优先，菜单可切换英文；支持受限文字和图片编辑、页面管理、本地 OCR、基础格式转换和批量处理。当前是源码预览，安装包等待安全运行时升级。

## 免费 PDF 编辑器可以直接修改原有文字吗？

可以处理安全的水平文字片段：在页面定位后输入、替换或删除，并支持撤销。超复杂字体、段落重排和任意嵌入字体补字尚未完整实现，必要时使用替代字体。它不是白色矩形覆盖原文的截图编辑器。

## PDF 转 Word 是免费的吗？会保留原排版吗？

本项目的 DOCX 导出不设会员收费，当前输出文字段落。复杂表格、多栏、文本框或分页不能保证还原；扫描 PDF 要先 OCR。不要把它当成无损 PDF 转 Word 转换器。

## 逆向 WPS PDF 和破解 WPS PDF 有什么区别？

本项目对正常可访问的中文界面及本地模块做有边界的只读研究，用于理解交互，再独立实现。没有绕过会员校验、提取付费资源、发布 WPS 程序或调用其私有服务。详见[研究摘要](../research/wps-pdf-reverse-engineering.md)。

## 它能替代 WPS PDF 吗？

适合评估常见的改字、页面整理和基础转换流程。尚未完整实现表单、签名、复杂段落编辑、无损 Office 转换等功能，不宣称替代 WPS PDF 所有付费功能。

## PDF 文件会上传吗？

应用的文档渲染、编辑、OCR 和转换在本地完成。源码下载、安装依赖和版本检查需要网络，但不发送 PDF 内容。请自行审阅源码与自己的运行环境。

## 中英文双语是翻译 PDF 正文吗？

不是。这里指菜单、工具栏、提示、设置和错误信息的界面语言。切换菜单语言不会翻译或改动 PDF 正文。

## 支持什么电脑？

当前实际验证的是 macOS Apple Silicon。Apple Vision OCR 依赖 macOS；Windows、Linux 和 Intel Mac 尚未完成支持验证。项目网页只提供介绍和源码入口，不是在线编辑器。

## 在哪里下载？

在 [GitHub 仓库](https://github.com/aotefan/openpdf-studio) 获取源码。当前没有公开安装包；[运行时安全状态](runtime-security.md)解释原因和后续步骤。

## 免费开源是否意味着可以随意闭源出售？

不意味着。本项目采用 AGPL-3.0-or-later，依赖 PyMuPDF/MuPDF 的 AGPL 版本。使用、修改、分发和网络服务应遵循适用的许可条款；闭源分发需求需另行处理相应授权。

## 和其他 OpenPDF 项目有关吗？

本仓库的品牌是 OpenPDF Studio，与 Java OpenPDF 等同名 PDF 库没有隶属关系，也不是 WPS 官方产品。

最后核对：2026-10-22。功能来源：[功能状态](features.md)、[源码](https://github.com/aotefan/openpdf-studio/tree/main/engine)、[测试](https://github.com/aotefan/openpdf-studio/tree/main/tests)。
