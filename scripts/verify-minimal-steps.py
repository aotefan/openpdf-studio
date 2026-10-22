"""Read actual UI exports with an independent PDF parser."""
import json
from pathlib import Path
from PIL import Image
from pypdf import PdfReader
from pypdf.generic import ContentStream

rows = []
replacement = Image.open('test-fixtures/replacement.png').convert('RGB')
for locale in ['zh-CN', 'en-US']:
    for kind in ['rotate', 'reorder', 'image-replaced', 'text-added']:
        file = Path(f'tests/results/minimal-{locale}-{kind}.pdf')
        reader = PdfReader(file)
        page = reader.pages[0]
        if kind == 'rotate':
            assert page.rotation == 90
        elif kind == 'reorder':
            assert 'Page 2:' in page.extract_text()
        elif kind == 'image-replaced':
            # Resources can retain unused image entries. Check the image actually
            # drawn by Do, without pypdf's high-level /SMask null image decoder.
            drawn = [page['/Resources']['/XObject'][args[0]].get_object()
                     for args, op in ContentStream(page.get_contents(), reader).operations
                     if op == b'Do']
            assert len(drawn) == 1
            image = drawn[0]
            assert image['/Subtype'] == '/Image'
            assert (image['/Width'], image['/Height']) == replacement.size
            cs = image['/ColorSpace']
            rgb = cs == '/DeviceRGB' or (isinstance(cs, list) and cs[0] == '/ICCBased'
                and cs[1].get_object()['/N'] == 3 and cs[1].get_object()['/Alternate'] == '/DeviceRGB')
            assert rgb and image['/BitsPerComponent'] == 8
            assert image.get_data() == replacement.tobytes()
        elif kind == 'text-added':
            assert 'Single apply text' in page.extract_text()
        rows.append({'locale': locale, 'operation': kind, 'pages': len(reader.pages),
                     'independentReadback': True})

en = json.loads(Path('src/i18n/en-US.json').read_text())
zh = json.loads(Path('src/i18n/zh-CN.json').read_text())
assert en.keys() == zh.keys()
result = {'outputs': rows, 'translationKeys': len(en)}
Path('tests/results/minimal-steps-readback.json').write_text(json.dumps(result, indent=2))
print(f'{len(rows)} independent readbacks passed; {len(en)} translation keys aligned')
