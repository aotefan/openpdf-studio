# Third-party notices

Project source: AGPL-3.0-or-later. This repository publishes the independent application source. Binary downloads are not included in this source release.

|Component|License / upstream|Use|
|---|---|---|
|PyMuPDF/MuPDF|AGPL-3.0 or commercial — https://github.com/pymupdf/PyMuPDF|PDF rendering/editing and bundled fonts|
|React / React DOM|MIT — https://github.com/facebook/react|UI|
|i18next / react-i18next|MIT — https://github.com/i18next/i18next|Localization|
|Lucide|ISC — https://github.com/lucide-icons/lucide|Independent open-source icons|
|Electron|MIT plus bundled Chromium/Node notices — https://github.com/electron/electron|Desktop runtime|
|Pillow|HPND — https://github.com/python-pillow/Pillow|Image processing|
|python-docx / python-pptx|MIT — https://github.com/python-openxml|Office exports|
|openpyxl|MIT — https://openpyxl.readthedocs.io|Spreadsheet export|
|lxml|BSD — https://lxml.de|XML dependency|
|pypdf|BSD-3-Clause — https://github.com/py-pdf/pypdf|Independent test reader|
|PyInstaller|GPL with bootloader distribution exception — https://pyinstaller.org|Local engine packaging|
|RapidOCR and bundled PP-OCR models|Apache-2.0 — https://github.com/RapidAI/RapidOCR ; https://github.com/PaddlePaddle/PaddleOCR|Windows offline Chinese/English OCR|
|ONNX Runtime|MIT — https://github.com/microsoft/onnxruntime|CPU inference|
|OpenCV|Apache-2.0 with third-party notices — https://github.com/opencv/opencv-python|OCR image processing|
|NumPy / Shapely / pyclipper|BSD-3-Clause / BSD-3-Clause (GEOS LGPL) / MIT — respective package license metadata|OCR arrays and geometry|
|Apple Vision|macOS system framework|Local OCR; not copied as a separate library|

Selected installed license files retained in docs/third-party-licenses. Electron distribution includes LICENSE and LICENSES.chromium.html. Full transitive audit remains a release gate for public redistribution; repository metadata alone is not a license determination. All WPS research evidence is excluded from the packaged application. No WPS assets or binaries are linked/copied.

Windows packaging preserves OCR distribution metadata and license files under the frozen worker. The application source, build scripts, lockfiles and notices accompany the package in resources/app/source. Review the retained transitive notices before public redistribution.
