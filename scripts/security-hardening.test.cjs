/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const ts = require('typescript');
const { NextRequest, NextResponse } = require('next/server');
const root = path.resolve(__dirname, '..');
function load(file, mocks = {}, env = {}) {
  const compiled = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(code, {
    module: compiled, exports: compiled.exports,
    require: (name) => Object.hasOwn(mocks, name) ? mocks[name] : require(name),
    process: { env }, Buffer, Headers, Request, Response, URL, URLSearchParams,
    Uint8Array, TextDecoder, console,
  }, { filename: file });
  return compiled.exports;
}
const { contentSecurityPolicy } = load('src/lib/security/content-policy.ts');
const { trustedClientAddress } = load('src/lib/security/client-address.ts');
const { proxy } = load('src/proxy.ts', {
  './lib/security/content-policy': { contentSecurityPolicy }, 'next/server': { NextRequest, NextResponse },
}, { NODE_ENV: 'production' });
const nonce = Buffer.alloc(32, 1).toString('base64');

test('CSP rejects injected or weak nonces', () => {
  for (const bad of ['', 'client-controlled', `${nonce}; script-src *`]) assert.throws(() => contentSecurityPolicy(bad, false, false));
});
test('production CSP allows nonced scripts but no unsafe-inline/eval or broad HTTPS connection', () => {
  const p = contentSecurityPolicy(nonce, false, false);
  const script = p.split('; ').find(x => x.startsWith('script-src'));
  assert.ok(script.includes(`'nonce-${nonce}'`));
  assert.ok(script.includes("'strict-dynamic'"));
  assert.ok(!script.includes('unsafe-inline') && !script.includes('unsafe-eval'));
  assert.ok(!p.includes("connect-src 'self' https:;") && !p.includes('clarity.ms'));
});
test('eval is permitted only in development; guest connections stay same-origin', () => {
  assert.ok(contentSecurityPolicy(nonce, true, false).includes("'unsafe-eval'"));
  assert.ok(!contentSecurityPolicy(nonce, true, false).includes('upgrade-insecure-requests'));
  const p = contentSecurityPolicy(nonce, false, true);
  assert.ok(p.includes("connect-src 'self';"));
  assert.ok(!p.includes('channex.io') && !p.includes('vercel-storage'));
});
test('proxy replaces spoofed CSP/nonce, emits fresh values and prevents shared caching', () => {
  const request = () => new NextRequest('https://example.invalid/dashboard', { headers: {
    'x-nonce': 'spoofed', 'Content-Security-Policy': 'script-src *',
  } });
  const a = proxy(request()), b = proxy(request());
  const p = a.headers.get('Content-Security-Policy');
  assert.notEqual(p, b.headers.get('Content-Security-Policy'));
  assert.equal(p, a.headers.get('x-middleware-request-content-security-policy'));
  assert.ok(!p.includes('spoofed'));
  assert.equal(a.headers.get('Cache-Control'), 'private, no-store');
  assert.notEqual(a.headers.get('x-middleware-request-x-nonce'), 'spoofed');
});
test('self-hosted rate limits do not trust arbitrary forwarding headers', () => {
  const h = new Headers({ 'x-real-ip': '203.0.113.4', 'x-forwarded-for': '203.0.113.5' });
  assert.equal(trustedClientAddress(h, {}), 'unknown');
  assert.equal(trustedClientAddress(h, { TRUSTED_CLIENT_IP_HEADER: 'x-real-ip' }), '203.0.113.4');
});
test('Vercel ingress identity ignores client x-real-ip and forwarded chains', () => {
  const h = new Headers({ 'x-real-ip': '203.0.113.99', 'x-vercel-forwarded-for': '203.0.113.4' });
  assert.equal(trustedClientAddress(h, { VERCEL: '1' }), '203.0.113.4');
  h.set('x-vercel-forwarded-for', '203.0.113.8, 203.0.113.4');
  assert.equal(trustedClientAddress(h, { VERCEL: '1' }), 'unknown');
});
test('invalid IP values are rejected and IPv6 is canonicalized', () => {
  const env = { TRUSTED_CLIENT_IP_HEADER: 'x-real-ip' };
  assert.equal(trustedClientAddress(new Headers({ 'x-real-ip': 'attacker' }), env), 'unknown');
  assert.equal(trustedClientAddress(new Headers({ 'x-real-ip': '2001:0DB8:0000:0000:0000:0000:0000:0001' }), env), '[2001:db8::1]');
});
const bodyModule = load('src/lib/security/request-body.ts');
function callback(env = {}) {
  const calls = [];
  const db = { tTLockLock: { findMany: async () => [{ id: 'lock', hotelId: 'tenant' }] },
    tTLockEvent: { createMany: async (data) => { calls.push(data); } } };
  const { POST } = load('src/app/api/ttlock/callback/route.ts', {
    'next/server': { NextRequest, NextResponse }, '@/lib/db': { db },
    '@/lib/security/request-body': bodyModule,
  }, { TTLOCK_CALLBACK_TOKEN: 'synthetic-test-only', ...env });
  return { POST, calls };
}
function request(body, token = true, query = '') {
  return new NextRequest(`https://example.invalid/api/ttlock/callback${query}`, {
    method: 'POST', headers: token ? { 'x-ttlock-callback-token': 'synthetic-test-only' } : {}, body,
  });
}
test('TTLock rejects URL secrets by default without business writes', async () => {
  const { POST, calls } = callback();
  assert.equal((await POST(request('lockId=123', false, '?token=synthetic-test-only'))).status, 401);
  assert.equal(calls.length, 0);
});
test('TTLock accepts authenticated bounded requests and strips secret payload fields', async () => {
  const { POST, calls } = callback();
  assert.equal((await POST(request('lockId=123&recordId=1&secret=do-not-store'))).status, 200);
  assert.equal(calls.length, 1);
  assert.ok(!Object.hasOwn(calls[0].data[0].payload, 'secret'));
  assert.equal(calls[0].skipDuplicates, true);
});
test('TTLock legacy URL authentication requires explicit opt-in', async () => {
  const { POST } = callback({ TTLOCK_CALLBACK_ALLOW_QUERY_TOKEN: 'true' });
  assert.equal((await POST(request('lockId=123', false, '?token=synthetic-test-only'))).status, 200);
});
test('wrong header does not fall back to a valid legacy URL secret', async () => {
  const { POST } = callback({ TTLOCK_CALLBACK_ALLOW_QUERY_TOKEN: 'true' });
  const req = request('lockId=123', false, '?token=synthetic-test-only');
  req.headers.set('x-ttlock-callback-token', 'incorrect');
  assert.equal((await POST(req)).status, 401);
});
test('TTLock byte limit works without Content-Length', async () => {
  const { POST, calls } = callback();
  assert.equal((await POST(request('lockId=123&data=' + 'я'.repeat(13000)))).status, 413);
  assert.equal(calls.length, 0);
});
test('TTLock invalid dates and oversized integer types never reach event writes', async () => {
  const { POST, calls } = callback();
  for (const body of ['lockId=123&date=1e100', 'lockId=123&recordType=2147483648']) {
    assert.equal((await POST(request(body))).status, 400);
  }
  assert.equal(calls.length, 0);
});
test('no global session recorder remains installed or injected', () => {
  const p = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.ok(!p.dependencies['@microsoft/clarity']);
  assert.ok(!fs.readFileSync(path.join(root, 'src/app/layout.tsx'), 'utf8').includes('<ClarityAnalytics'));
  assert.ok(!fs.readFileSync(path.join(root, 'src/components/analytics/clarity.tsx'), 'utf8').includes('Clarity.init'));
});
test('Next lint glob API still supports directory and brace patterns through the reviewed alias', () => {
  const { getRootDirs } = require('@next/eslint-plugin-next/dist/utils/get-root-dirs');
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'next-lint-glob-'));
  try {
    for (const dir of ['a', 'b']) fs.mkdirSync(path.join(fixture, 'apps', dir), { recursive: true });
    const dirs = getRootDirs({ cwd: fixture, settings: { next: { rootDir: path.join(fixture, 'apps/{a,b}') } } });
    assert.deepEqual(dirs.map(x => path.resolve(x)).sort(), ['a', 'b'].map(x => path.join(fixture, 'apps', x)).sort());
  } finally { fs.rmSync(fixture, { recursive: true, force: true }); }
});
test('Next lint rules still execute after the glob dependency replacement', async () => {
  const { ESLint } = require('eslint');
  const eslint = new ESLint({ cwd: root });
  const [result] = await eslint.lintText('export default function Example(){return <img src="/test.png" alt="x" />}', {
    filePath: path.join(root, 'src', 'lint-compatibility-fixture.tsx'),
  });
  assert.ok(result.messages.some(x => x.ruleId === '@next/next/no-img-element'));
});
