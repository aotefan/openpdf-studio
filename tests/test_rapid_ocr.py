import json
import os
import subprocess
import sys
from pathlib import Path

import pytest
import pymupdf as fitz

sys.path.insert(0, str(Path(__file__).parents[1] / 'engine'))
from rapid_ocr import normalize_results
from core import Engine, b64


def test_image_coordinates_become_pdf_bottom_left_coordinates():
    result = normalize_results([([[10, 20], [90, 20], [90, 40], [10, 40]], '中文 English', .91)], 100, 200)
    assert result[0]['rect'] == pytest.approx([.1, .8, .8, .1])
    assert result[0]['text'] == '中文 English'
    assert result[0]['confidence'] == .91


def test_clip_bounds_and_reject_invalid_coordinates():
    assert normalize_results([([[-1, -1], [101, -1], [101, 201], [-1, 201]], 'text', 2)], 100, 200)[0]['rect'] == [0, 0, 1, 1]
    with pytest.raises(ValueError):
        normalize_results([([[float('nan'), 0]] * 4, 'bad', 1)], 100, 100)
    assert normalize_results(None, 100, 100) == []


def test_offline_ocr_unicode_path_and_searchable_pdf(tmp_path, monkeypatch):
    pytest.importorskip('rapidocr_onnxruntime')
    folder = tmp_path / '中文 文档'
    folder.mkdir()
    with fitz.open('test-fixtures/ocr-batch.pdf') as pdf:
        image = folder / '扫描.png'
        pdf[0].get_pixmap(matrix=fitz.Matrix(2, 2)).save(image)
    result = subprocess.run([sys.executable, '-X', 'utf8', 'engine/worker.py', '--ocr', str(image)],
                            capture_output=True, text=True, encoding='utf-8', check=True, timeout=120,
                            env={**os.environ, 'HTTP_PROXY': 'http://127.0.0.1:1', 'HTTPS_PROXY': 'http://127.0.0.1:1'})
    lines = json.loads(result.stdout)
    text = ''.join(line['text'] for line in lines)
    assert '中文文字识别测试' in text
    assert 'OpenPDF' in text
    monkeypatch.setenv('OPENPDF_OCR_BACKEND', 'rapidocr')
    engine = Engine()
    doc = engine.open(b64(Path('test-fixtures/ocr-batch.pdf').read_bytes()), '中文扫描.pdf')
    preview = engine.preview(doc['id'], [{'type': 'ocr', 'page': 0}])
    assert preview['diff'] == []
    engine.commit(doc['id'], preview['token'])
    with fitz.open(stream=engine.session(doc['id']).data, filetype='pdf') as saved:
        assert saved[0].search_for('中文文字识别测试')
