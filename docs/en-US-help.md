# OpenPDF Studio guide

Open a PDF, navigate with thumbnails or the page field, and adjust zoom at the bottom right. Enter a search phrase and press Return.

On Home, hover over text for an I-beam pointer, click to place the caret and type to enter Edit automatically. You can also choose Edit first to select text or images. Text applies when you click outside, press Enter, save or navigate; Esc cancels. Image property settings apply once. Cmd+Z undoes and Shift+Cmd+Z redoes. Unsafe overflow, overlapping text and shared image changes are rejected.

Add text: choose Edit → Add text, move the following frame to a page location and click to type. Click outside or press Enter to finish, Shift+Enter for a new line, Esc to cancel. No coordinate form is required. Content that cannot fit on the page stays in the editor for correction.

Word export contains text paragraphs; Excel contains detected tables or text rows; PowerPoint contains page images. DOCX import reflows text and tables. Complex formatting is not guaranteed.

Word, Excel and PowerPoint shortcuts on the Convert tab export the chosen format directly and ask for a save destination. Home → Convert still offers a format choice. Exporting another format preserves the PDF's unsaved state; cancelling the save leaves the document unchanged.

OCR adds a searchable hidden text layer to the current unrotated scan page. Review extracted text for recognition errors. OCR correction and rewriting text inside scan images are not available.

Settings → Interface language switches immediately between Simplified Chinese and English without translating the PDF. Processing is local. No WPS AI services are connected.

Inline text: choose Edit, click text on the page and type. Enter or the nearby check mark opens a preview; Esc cancels the draft. The inspector controls size, color and style. Unapplied text is protected when navigating away.

Batch conversion: Convert / Batch → Batch conversion → Choose PDF files → Choose output folder → review outputs → Start batch conversion. Cancel discards staged results. All-success output can be opened in Finder. Reads disk files, excluding unsaved edits. OCR and save scans before DOCX/XLSX/TXT conversion.

Keyword markup (0.1.10): Annotate → Highlight / Underline / Strikeout → enter a keyword and page range → choose color and opacity → preview and apply. Also available under Batch → Keyword markup. Original text, fonts and underlying graphics are retained. Manage keyword markups lists only annotations created by this feature; selected removal, undo/redo and saved persistence are supported. OCR scans first. Search is ASCII case-insensitive and matches substrings; identical type/region pairs are skipped. Strikeout is a visual annotation, not redaction.

Minimum steps (0.1.11): Rotate, add/delete and move pages directly. Image insert/replace applies after file selection; image deletion and property changes need no second confirmation. In Manage pages, select the range and act once; staged reordering uses Apply new order. Keyword markups apply directly after the match summary. Text insertion, watermarks, headers/footers and page canvas size have one Apply action and optional visual preview. Internal integrity checks and undo remain. Batch text replacement and OCR retain layout/result review.
