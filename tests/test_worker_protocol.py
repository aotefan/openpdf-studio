import base64
import json
import subprocess
import sys
from pathlib import Path


def test_worker_excel_diagnostics_do_not_corrupt_utf8_rpc():
    worker = subprocess.Popen([sys.executable, '-X', 'utf8', 'engine/worker.py'],
                              stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                              text=True, encoding='utf-8')
    try:
        def call(method, params):
            worker.stdin.write(json.dumps({'id': 1, 'method': method, 'params': params}, ensure_ascii=False) + '\n')
            worker.stdin.flush()
            return json.loads(worker.stdout.readline())['result']
        document = call('open', {'name': '合同 中文.pdf', 'data': base64.b64encode(Path('test-fixtures/research.pdf').read_bytes()).decode()})
        assert document['name'] == '合同 中文.pdf'
        result = call('export', {'sid': document['id'], 'format': 'xlsx'})
        assert base64.b64decode(result['data']).startswith(b'PK')
        assert call('info', {'sid': document['id']})['pages']
    finally:
        worker.stdin.close()
        worker.wait(timeout=20)
        worker.stdout.close()
        worker.stderr.close()
