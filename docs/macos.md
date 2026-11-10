# Mac 安装指南 / Mac installation

**[下载 OpenPDF Studio 0.2.2 Mac 安装包（DMG）](https://github.com/aotefan/openpdf-studio/releases/download/v0.2.2/OpenPDF-Studio-0.2.2-macos-arm64.dmg)**

适用于 **Apple Silicon（M 系列芯片）、macOS 14 或更高版本**。此包不适用于 Intel Mac。无需登录 GitHub，也无需安装 Python、Node 或 Office。

## 安装与使用

1. 打开下载的 `.dmg` 文件。
2. 将 **OpenPDF Studio.app** 拖到同一窗口里的 **Applications（应用程序）**。
3. 从“应用程序”打开 OpenPDF Studio。更新旧版时先保存文档并退出旧应用，再替换。
4. 安装完成后推出磁盘映像，DMG 文件可以删除。

高清图片导出：打开 PDF →「转换 → 页面转图片」→ 选择 **300 DPI 或 600 DPI** → 选择页码 → 导出 ZIP。

## 首次打开

当前是开发预览，使用本地临时签名保证包内完整性，**未使用 Apple Developer ID 签名，也未经过 Apple 公证**。macOS 可能提示无法验证开发者。确认文件来自本项目 Release 后，可按照 [Apple 官方说明](https://support.apple.com/en-us/102445)，在“系统设置 → 隐私与安全性”查看该应用的“仍要打开”选项。无需关闭系统安全检查。

文件完整性可与同一 Release 的 [SHA256SUMS.txt](https://github.com/aotefan/openpdf-studio/releases/download/v0.2.2/SHA256SUMS.txt) 核对：

```sh
shasum -a 256 OpenPDF-Studio-0.2.2-macos-arm64.dmg
```

## 构建与验证范围

从源码配置依赖后，运行 `npm run package:mac`，会先构建原生应用，再生成带 Applications 快捷方式的 DMG。已有同版本、已验证的 `.app` 可通过 `node scripts/package-dmg.mjs` 封装。脚本不覆盖已有 DMG，防止误改已发布的附件。

应用、OCR helper 及全部原生库的部署目标检查以 macOS 14 为上限；NumPy 的原生包决定本版的最低系统目标。原生 OCR 使用 Apple Vision。实际成品验证在 macOS 27 / Apple Silicon 上运行；macOS 14–26 和 Intel Mac 未作实体机验收。

源码位于应用内 `Contents/Resources/app/source`，原生引擎构建版本记录在 `Contents/Resources/engine/build-info.json`。源码按 AGPL-3.0-or-later 提供，第三方许可随包附带。

## English

Download the DMG above, open it, drag **OpenPDF Studio.app** to **Applications**, then launch it from Applications. This package targets **macOS 14+ on Apple Silicon**; it does not support Intel Macs. Save your documents and quit an existing copy before replacing it.

This preview is ad-hoc signed but is not Developer ID signed or notarized. macOS may block its first launch; consult the linked Apple instructions. The package includes its runtime and corresponding source. Native deployment targets are checked against macOS 14; packaged-app testing runs on macOS 27, with older supported OS versions not physically tested.
