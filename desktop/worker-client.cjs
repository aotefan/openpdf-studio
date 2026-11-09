const {spawn, spawnSync} = require('node:child_process');
const readline = require('node:readline');

class WorkerClient {
  constructor({command, args, options}) {
    this.seq = 0;
    this.pending = new Map();
    this.stopped = false;
    this.child = spawn(command, args, options);
    this.lines = readline.createInterface({input: this.child.stdout});
    this.lines.on('line', line => {
      try {
        const response = JSON.parse(line);
        const request = this.pending.get(response.id);
        if (!request) return;
        this.pending.delete(response.id);
        if (response.error) request.reject(new Error(response.error.code));
        else request.resolve(response.result);
      } catch { this.fail(); }
    });
    this.child.stderr.on('data', bytes => console.error(bytes.toString('utf8')));
    this.child.on('error', () => this.fail());
    this.child.on('exit', () => this.fail());
    this.child.stdin.on('error', () => this.fail());
  }
  fail() {
    this.stopped = true;
    for (const request of this.pending.values()) request.reject(new Error('engineStopped'));
    this.pending.clear();
  }
  call(method, params = {}) {
    if (this.stopped || !this.child.stdin.writable) return Promise.reject(new Error('engineStopped'));
    return new Promise((resolve, reject) => {
      const id = ++this.seq;
      let message;
      try { message = JSON.stringify({id, method, params}) + '\n'; }
      catch (error) { reject(error); return; }
      this.pending.set(id, {resolve, reject});
      this.child.stdin.write(message, error => { if (error) this.fail(); });
    });
  }
  kill() {
    this.fail();
    this.lines.close();
    // Windows does not propagate termination to the in-flight OCR subprocess.
    if (process.platform === 'win32' && this.child.pid && this.child.exitCode === null) {
      spawnSync('taskkill.exe', ['/pid', String(this.child.pid), '/t', '/f'], {windowsHide: true, stdio: 'ignore', timeout: 5000});
    }
    this.child.kill();
  }
}
module.exports = {WorkerClient};
