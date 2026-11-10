import base64
import io
import sys
import zipfile
from pathlib import Path

import pymupdf as fitz
import pytest
from PIL import Image

sys.path.insert(0, str(Path(__file__).parents[1] / 'engine'))
import core
from core import Engine, EngineError, b64


def fixture_document(width=72, height=144):
    engine = Engine()
    with fitz.open() as pdf:
        page = pdf.new_page(width=width, height=height)
        page.draw_line((36, 20), (36, 120), color=(0, 0, 0), width=.25)
        page.insert_text((5, 10), 'Fine text', fontsize=4)
        raw = pdf.tobytes()
    doc = engine.open(b64(raw), '中文 高清.pdf')
    return engine, doc, raw


def read_images(result):
    with zipfile.ZipFile(io.BytesIO(base64.b64decode(result['data']))) as archive:
        assert archive.testzip() is None
        images = {}
        for name in archive.namelist():
            image = Image.open(io.BytesIO(archive.read(name)))
            image.load()
            images[name] = image
        return images


@pytest.mark.parametrize('dpi', [150, 300, 600])
def test_real_pixels_lossless_color_and_dpi_metadata(dpi):
    engine, doc, raw = fixture_document()
    result = engine.export(doc['id'], 'png', dpi=dpi)
    image = read_images(result)['page-1.png']
    assert image.format == 'PNG'
    assert image.size == (dpi, dpi * 2)
    assert image.mode == 'RGB'
    assert image.info['dpi'] == pytest.approx((dpi, dpi), abs=.02)
    assert image.getpixel((0, 0)) == (255, 255, 255)
    assert image.getpixel((dpi // 2, dpi))[0] < 255  # original thin vector line survives
    assert result['name'] == f'中文 高清-{dpi}dpi.zip'
    assert result['extension'] == 'zip'
    assert engine.session(doc['id']).data == raw
    assert engine.info(doc['id'])['revision'] == 0


def test_default_is_300_dpi_and_a4_600_is_not_capped_or_upscaled():
    engine, doc, _ = fixture_document(595, 842)
    image = read_images(engine.export(doc['id'], 'png'))['page-1.png']
    assert image.size == (2480, 3509)
    assert image.info['dpi'][0] == pytest.approx(300, abs=.02)
    del image
    image = read_images(engine.export(doc['id'], 'png', dpi=600))['page-1.png']
    assert image.size == (4959, 7017)
    assert image.info['dpi'][0] == pytest.approx(600, abs=.02)


def test_selected_pages_keep_source_numbers_crop_rotation_and_annotations():
    engine = Engine()
    with fitz.open() as pdf:
        page = pdf.new_page(width=72, height=144)
        annot = page.add_rect_annot((10, 10, 30, 30))
        annot.set_colors(stroke=(1, 0, 0), fill=(1, 0, 0))
        annot.update()
        page = pdf.new_page(width=144, height=216)
        page.draw_rect(page.rect, fill=(0, 0, 1), color=(0, 0, 1))
        page.set_cropbox(fitz.Rect(12, 24, 132, 204))
        page.set_rotation(90)
        doc = engine.open(b64(pdf.tobytes()))
    images = read_images(engine.export(doc['id'], 'png', pages=[1, 0]))
    assert list(images) == ['page-2.png', 'page-1.png']
    assert images['page-2.png'].size == (750, 500)
    assert images['page-2.png'].getpixel((375, 250)) == (0, 0, 255)
    assert images['page-1.png'].getpixel((83, 83)) == (255, 0, 0)


@pytest.mark.parametrize('dpi', [0, 144, 299, 601, 300.0, True, '600', None])
def test_invalid_resolution_is_rejected(dpi):
    engine, doc, _ = fixture_document()
    with pytest.raises(EngineError, match='invalidImageDpi'):
        engine.export(doc['id'], 'png', dpi=dpi)


def test_oversized_page_is_rejected_before_any_page_renders(monkeypatch):
    engine = Engine()
    with fitz.open() as pdf:
        pdf.new_page(width=72, height=72)
        pdf.new_page(width=15000, height=15000)
        raw = pdf.tobytes()
    doc = engine.open(b64(raw))
    def should_not_render(*args, **kwargs):
        pytest.fail('preflight must reject before allocating a pixmap')
    monkeypatch.setattr(fitz.Page, 'get_pixmap', should_not_render)
    with pytest.raises(EngineError, match='imageExportPageTooLarge'):
        engine.export(doc['id'], 'png', dpi=600)
    assert engine.session(doc['id']).data == raw


def test_archive_size_limit_preserves_document_and_retry(monkeypatch):
    engine, doc, raw = fixture_document()
    with monkeypatch.context() as patch:
        patch.setattr(core, 'MAX_IMAGE_EXPORT_BYTES', 64)
        with pytest.raises(EngineError, match='imageExportTooLarge'):
            engine.export(doc['id'], 'png')
    assert engine.session(doc['id']).data == raw
    assert read_images(engine.export(doc['id'], 'png', dpi=150))['page-1.png'].size == (150, 300)


@pytest.mark.parametrize('pages', [[True], [0, 0], [], '1'])
def test_invalid_image_page_selection(pages):
    engine, doc, _ = fixture_document()
    with pytest.raises(EngineError, match='invalidPage'):
        engine.export(doc['id'], 'png', pages=pages)
