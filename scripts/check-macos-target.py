"""Reject a Mac distribution whose native libraries exceed its declared OS target."""
import plistlib
import sys
from pathlib import Path
from macholib.MachO import MachO

bundle = Path(sys.argv[1])
with (bundle / 'Contents/Info.plist').open('rb') as source:
    minimum = plistlib.load(source)['LSMinimumSystemVersion']
parts = [int(x) for x in minimum.split('.')]
parts += [0] * (3 - len(parts))
limit = (parts[0] << 16) | (parts[1] << 8) | parts[2]
count = 0
for binary in bundle.rglob('*'):
    if binary.is_symlink() or not binary.is_file():
        continue
    with binary.open('rb') as source:
        magic = source.read(4)
    if magic not in (b'\xcf\xfa\xed\xfe', b'\xfe\xed\xfa\xcf', b'\xca\xfe\xba\xbe', b'\xbe\xba\xfe\xca'):
        continue
    for header in MachO(str(binary)).headers:
        for lc, command, _ in header.commands:
            target = command.minos if lc.cmd == 0x32 else command.version if lc.cmd == 0x24 else None
            if target is not None:
                count += 1
                if target > limit:
                    raise SystemExit(f'{binary.relative_to(bundle)} requires macOS {target >> 16}.{(target >> 8) & 255}, above {minimum}')
if not count:
    raise SystemExit('No native deployment targets found')
print(f'Verified {count} native deployment targets against macOS {minimum}')
