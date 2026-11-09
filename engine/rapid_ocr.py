"""Offline OCR adapter. Models are included in the rapidocr-onnxruntime wheel."""
import contextlib
import json
import math
import sys
from pathlib import Path


def normalize_results(results, width, height):
    """Convert image quadrilaterals to the normalized, bottom-left Vision contract."""
    lines = []
    for points, text, score in results or []:
        if not isinstance(text, str) or len(points) != 4:
            raise ValueError('Invalid OCR result')
        coords = [float(v) for point in points for v in point]
        score = float(score)
        if len(coords) != 8 or not all(math.isfinite(v) for v in [*coords, score]):
            raise ValueError('Invalid OCR coordinates')
        left = max(0., min(coords[::2]))
        top = max(0., min(coords[1::2]))
        right = min(float(width), max(coords[::2]))
        bottom = min(float(height), max(coords[1::2]))
        if text.strip() and right > left and bottom > top:
            lines.append({'text': text, 'confidence': max(0., min(1., score)),
                          'rect': [left / width, 1 - bottom / height,
                                   (right - left) / width, (bottom - top) / height]})
    return lines


def recognize(image_path):
    import numpy as np
    from PIL import Image
    from rapidocr_onnxruntime import RapidOCR
    # Loading through Pillow handles non-ASCII Windows paths without cv2.imread.
    with Image.open(image_path) as image:
        image = image.convert('RGB')
        width, height = image.size
        pixels = np.array(image)[:, :, ::-1].copy()
    engine = RapidOCR(intra_op_num_threads=2, inter_op_num_threads=1)
    results, _ = engine(pixels)
    return normalize_results(results, width, height)


def main(image_path):
    # Keep the JSON protocol clean even if a dependency prints a diagnostic.
    with contextlib.redirect_stdout(sys.stderr):
        lines = recognize(Path(image_path))
    print(json.dumps(lines, ensure_ascii=False), flush=True)
