# Windows x64 源码预览

0.2.0 增加 Windows 10/11 x64 的启动、离线 OCR、原生菜单及便携 ZIP 构建路径。当前开发主机为 macOS；Windows 原生执行与最终 ZIP 必须由 Windows 工作流或实体机器验收，不能把 macOS 测试视为 Windows 已通过。

## 使用已构建的便携版

Windows 工作流通过全部测试后，生成 `OpenPDF-Studio-0.2.0-windows-x64.zip` 构建产物。完整解压，运行其中的 `OpenPDF Studio.exe`。保留旁边的 `resources`、DLL 和其他文件；不要只复制 EXE。运行时已包含 Python 引擎、OCR 模型及依赖，不需要安装 Node、Python、Office 或额外语言包，也不需要上传文档。

此版本没有安装器、自动更新、文件关联或代码签名。Windows ARM64 原生构建、32 位 Windows 和 Windows 7/8 不在当前支持范围内。Windows 10 仅指应用兼容目标；操作系统维护周期由 Microsoft 决定。

## 从源码构建（PowerShell）

安装 x64 Node（`.nvmrc` 当前为 26.13.0 LTS）和 [uv](https://docs.astral.sh/uv/getting-started/installation/)。通过 uv 获取 Python 3.12.14，避免 Windows 官方安装器停留在 3.12.10。构建前重新核对 [Node 安全公告](https://nodejs.org/en/blog/vulnerability) 与 [Electron 版本](https://releases.electronjs.org/)。然后在项目目录执行：

```powershell
uv python install 3.12.14
uv venv --python 3.12.14 .venv
uv pip install --python .venv\Scripts\python.exe -r requirements-windows.lock
npm ci --ignore-scripts
node scripts/check-runtime.cjs --electron
node node_modules/electron/install.js
npm run check:runtime -- --electron --installed
npm run build
npm start
```

无需激活虚拟环境或调整 PowerShell 执行策略。Python、Node 和目标 Electron 必须都是 x64。`requirements-windows.lock` 固定 Windows 的完整 Python 依赖；更新输入要求后用 `uv pip compile requirements-windows.txt --python-platform windows --python-version 3.12 --no-header --output-file requirements-windows.lock` 重新生成。

```powershell
npm run test:desktop
npm run test:engine
npm run test:ui
npm run package:win
npm run test:packaged
```

`package:win` 自动检查已安装的运行时，编译前端，用 PyInstaller 打包本机 Python 引擎，收集 OCR 模型和本地库，生成图标及便携 ZIP。输出在 `release/artifacts.noindex/0.2.0/`。不支持从 Mac 把 macOS 引擎拷进 Windows 安装目录；脚本会直接拒绝这种跨系统构建。

## Windows 行为

- `Ctrl+O` 打开，`Ctrl+S` 另存副本，`Ctrl+Z` 撤销，`Ctrl+Y` 重做，`Ctrl+F` 搜索。也保留 `Ctrl+Shift+Z` 重做。菜单、工具提示及帮助与平台一致。
- Python 开发路径为 `.venv\Scripts\python.exe`，发布路径为 `resources\engine\openpdf-engine.exe`；后台进程隐藏控制台。
- Python 通信固定 UTF-8，支持中文、空格用户名和文件路径。退出/启动失败会拒绝未完成的请求并显示错误。
- Windows OCR 使用 RapidOCR / ONNX Runtime CPU 和随包附带的 PP-OCR 中英文模型；macOS 继续使用 Apple Vision。两者识别结果可能不同。
- OCR 只添加隐藏搜索文字层，提交前仍执行逐像素核验。混合文字页、旋转页等原有限制不变。单页超时为 120 秒；取消会等待当前页结束后丢弃临时结果。
- 便携包从移动后的中文空格目录启动；测试覆盖原生保存、保存重开、离线 OCR、Office 导出、运行时真实版本及页面错误。

## 自动验收

`.github/workflows/windows.yml` 在 Windows runner 上安装锁定依赖，执行引擎、桌面逻辑、中英文 UI、打包和迁移目录后的便携包测试。只有全部成功才上传 ZIP；失败保留测试证据。可在 GitHub Actions 手动运行 `Windows x64 preview`，或由 PR / main 推送触发。

工作流文件已准备，并不表示它已在远端运行；发布下载前必须确认真实 Windows 作业结果。当前本地源码不包含已验证的 Windows 二进制文件。

## 2026-11-09 本地验证记录

开发主机为 macOS arm64，实际使用 Node 26.13.0、Electron 45.2.3 / 内置 Node 24.22.2、Python 3.12.14。

|检查|结果|范围|
|---|---|---|
|引擎测试|90 项通过|整套测试切换到 Windows 所用的 RapidOCR 后端，在 macOS 执行|
|桌面逻辑|15 项通过|Windows 路径、中文通信、子进程失败处理、批量转换、运行时规则|
|中英文 UI|28 项通过|打开、编辑、保存、撤销重做、OCR、转换；macOS Electron 实际界面|
|离线模型冻结|通过|PyInstaller 冻结 RapidOCR 后，在独立目录执行子进程 OCR、中文搜索和保存重开；像素不变|
|应用迁移目录|通过|macOS 成品移入中文空格目录，保存重开、OCR、DOCX/XLSX/PPTX/PNG/TXT 导出及真实运行时检查|
|Windows x64 wheels|47 个包解析、下载及安装到隔离目标目录成功|仅依赖可获得性检查，没有执行 Windows DLL|
|npm audit|0 项已知漏洞|执行时依赖树审计|
|Windows 原生构建与 UI|尚未执行|需要 Windows runner；当前主机不具备 Windows 环境|

界面验证使用仓库 Playwright（Browser plugin not available），覆盖 1496×855、1280×850、980×640 的桌面窗口；这是桌面应用，没有移动端支持目标。页面身份、非空白、无框架错误层、控制台及实际交互均通过相关测试。首次回归发现表格库提示污染 JSON 通信，现已将库诊断转到 stderr，并增加通信回归测试。
