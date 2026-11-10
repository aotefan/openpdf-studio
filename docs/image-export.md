# 高清图片导出 / High-resolution image export

从 0.2.1 开始，PNG 导出默认使用 300 DPI，并可选择 150 或 600 DPI。每一页直接从 PDF 渲染为无损 PNG，写入相同的 DPI 元数据，最后打包为 ZIP。

## 使用方法

1. 打开 PDF，进入「转换 → 页面转图片」。
2. 选择图片清晰度：150 DPI 文件较小；300 DPI 为默认高清；600 DPI 适合细字、放大和高分辨率打印。
3. 输入页码范围，例如 `1-3,5`；窗口显示选中页数和首个选中页面的预计像素尺寸。
4. 点击「导出高清图片」，选择 ZIP 保存位置并解压。文件名包含清晰度，例如 `报告-600dpi.zip`；只导出第 5 页时，图片仍命名为 `page-5.png`。

「开始 → 转换」选择图片格式，以及「批量转换」选择「页面转图片」时，也可以设置相同清晰度。批量转换读取磁盘上的 PDF。

以 595 × 842 pt 页面为例：

|设置|实际 PNG 像素尺寸|
|---|---|
|旧版固定渲染（144 DPI）|1190 × 1684|
|150 DPI|1240 × 1755|
|300 DPI（默认）|2480 × 3509|
|600 DPI|4959 × 7017|

图片包含当前页面的旋转、裁剪和可见批注，使用 RGB 色彩和白色背景。更高 DPI 能保留矢量文字和线条的细节，但无法恢复低清扫描原图中已经缺失的信息。取消保存或保存失败时会保留清晰度和页码设置，便于重试；导出不会清除 PDF 的未保存编辑状态。

为控制内存占用，每页最多 4000 万像素，每份 ZIP 最多 128 MiB；逐页生成，ZIP 暂存在本机临时文件。超限时提示降低 DPI，或在单份导出中缩小页码范围。A4 页面可使用 600 DPI，更大的页面可能需要 300 DPI。预计像素以首个选中页面为例，不同尺寸页面的结果会不同。

## English

Choose **Convert → Page images**, select **150, 300 (default), or 600 DPI**, enter a page range, then save and extract the ZIP. Generic conversion and multi-file conversion expose the same resolution choices. PNG files retain original page numbers; ZIP filenames include the selected DPI.

Pages are rendered directly from the PDF, including rotation, cropping and visible annotations, with lossless RGB pixels, a white background and matching PNG DPI metadata. A 595 × 842 pt page exports to 4959 × 7017 pixels at 600 DPI. Higher resolution preserves vector detail but cannot reconstruct detail missing from a blurry scan.

Limits are 40 million pixels per page and 128 MiB per archive. Reduce DPI or export fewer pages when the limit is reached. Cancelling or failing to save preserves the dialog settings for retry; exporting images preserves the document's unsaved edit state.
