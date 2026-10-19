/* eslint @typescript-eslint/no-require-imports: "off" -- CommonJS boundary-mocking harness. */
// No network or real DB. Execute actual source with controlled boundary mocks.
// PostgreSQL locking/concurrency and production build remain staging release gates.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
class PublicError extends Error {}
class RateLimitError extends Error {}
const ok = (data, message) => ({ ok: true, data, message });
const fail = (error) => ({ ok: false, error });
function load(file, mocks = {}, names) {
  let source = fs.readFileSync(path.join(root, file), 'utf8');
  if (names) {
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
    source = ast.statements.filter(n => n.name && names.includes(n.name.text)).map(n => { const text=n.getText(ast); return text.startsWith('export ') ? text : 'export '+text; }).join('\n');
  }
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const compiled = { exports: {} };
  const sandbox = { module: compiled, exports: compiled.exports, require: id => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (id.startsWith('node:') || ['zod'].includes(id)) return require(id);
    throw new Error(`Unmocked dependency ${id} in ${file}`);
  }, ...mocks, console, process, crypto: require('node:crypto').webcrypto, TextDecoder, Request, Response, AbortSignal, Buffer, Date, setTimeout, clearTimeout };
  vm.runInNewContext(js, sandbox, { filename: file, timeout: 2000 });
  return compiled.exports;
}
const money = load('src/lib/security/money.ts');
for (const [input, expected] of [['0.29',29],[0.29,29],['1.01',101],['1000.01',100001],['100',10000],['0',0],['1.001',null],['NaN',null],['Infinity',null],[-1,null],['1e3',null],['',null]]) {
  test(`decimal money ${JSON.stringify(input)}`, () => assert.equal(money.minorUnits(input), expected));
}
const numbers = load('src/lib/rooms/onboarding-numbers.ts');
test('single duplicate nonnumeric name returns instead of spinning', () => assert.throws(() => numbers.onboardingNumbers('Studio',1,['studio'])));
test('numeric batch skips occupied names', () => assert.equal(JSON.stringify(numbers.onboardingNumbers('9',3,['9','11'])), JSON.stringify(['10','12','13'])));
test('unsafe numeric suffix is rejected', () => assert.throws(() => numbers.onboardingNumbers('999999999999999999999999',2,[])));
test('long generated names are rejected', () => assert.throws(() => numbers.onboardingNumbers('x'.repeat(80),2,[])));
const body = load('src/lib/security/request-body.ts');
test('bounded JSON accepts a small request', async () => assert.equal((await body.readBoundedJson(new Request('https://test.invalid',{method:'POST',body:'{"ok":true}'}),100)).ok,true));
test('bounded body rejects oversize without Content-Length', async () => assert.rejects(body.readBoundedJson(new Request('https://test.invalid',{method:'POST',body:'x'.repeat(101)}),100),e=>e.status===413));
test('bounded JSON rejects malformed input', async () => assert.rejects(body.readBoundedJson(new Request('https://test.invalid',{method:'POST',body:'{' }),100),e=>e.status===400));
const inbox = load('src/lib/telegram-admin/inbox.ts');
const admin = new Set(['42']);
for (const [kind,msg,expected] of [
  ['private',{chat:{id:42,type:'private'},from:{id:42}},true],
  ['group',{chat:{id:-10,type:'group'},from:{id:42}},false],
  ['other chat',{chat:{id:43,type:'private'},from:{id:42}},false],
  ['non-admin',{chat:{id:43,type:'private'},from:{id:43}},false],
  ['bot',{chat:{id:42,type:'private'},from:{id:42,is_bot:true}},false],
]) test(`Telegram ${kind}`,()=>assert.equal(inbox.privateAdminMessage(msg,admin),expected));
function telegramDb() {
  let receipts = new Map(), effects=0;
  const tx = {$queryRaw:async()=>[],telegramCommandReceipt:{findUnique:async({where})=>receipts.get(String(where.updateId)),create:async({data})=>receipts.set(String(data.updateId),data)}};
  const db = {$transaction:async fn=>{const saved=new Map(receipts),old=effects;try{return await fn(tx)}catch(e){receipts=saved;effects=old;throw e}}};
  return {db, effect:()=>++effects, count:()=>effects};
}
test('Telegram duplicate update does not grant twice',async()=>{const f=telegramDb();await inbox.executeTelegramUpdate(f.db,1,['42','/grant'],async()=>String(f.effect()));await inbox.executeTelegramUpdate(f.db,1,['42','/grant'],async()=>String(f.effect()));assert.equal(f.count(),1)});
test('Telegram same update with another payload fails closed',async()=>{const f=telegramDb();await inbox.executeTelegramUpdate(f.db,1,['a'],async()=>String(f.effect()));await assert.rejects(inbox.executeTelegramUpdate(f.db,1,['b'],async()=>String(f.effect())));assert.equal(f.count(),1)});
test('Telegram effect and receipt roll back together',async()=>{const f=telegramDb();await assert.rejects(inbox.executeTelegramUpdate(f.db,1,['a'],async()=>{f.effect();throw new Error('fault')}));assert.equal(f.count(),0);await inbox.executeTelegramUpdate(f.db,1,['a'],async()=>String(f.effect()));assert.equal(f.count(),1)});
const operations = load('src/lib/reservations/operation.ts',{'@/server/errors':{PublicError}});
function financeFixture(auditFails=false) {
  let state={rows:[],receipts:[],audits:[]};
  const tx={$queryRaw:async()=>[],reservation:{findFirst:async()=>({id:'r',rentalPropertyId:'p',currency:'KZT'})},hotel:{findUniqueOrThrow:async()=>({orgId:'o'})},operationReceipt:{findUnique:async({where})=>state.receipts.find(r=>r.key===where.userId_hotelId_key.key),create:async({data})=>state.receipts.push(data)},financialOperation:{create:async({data})=>{const row={id:String(state.rows.length+1),...data};state.rows.push(row);return row}}};
  const db={$transaction:async fn=>{const before=structuredClone(state);try{return await fn(tx)}catch(e){state=before;throw e}}};
  const mocks={'next/cache':{revalidatePath:()=>{}},'@/lib/db':{db},'@/server/guards':{requireSessionHotelId:async()=> 'h'},'@/lib/reservations/service':{writeAudit:async(...args)=>{assert.equal(args[7],tx);if(auditFails)throw new Error('audit failure');state.audits.push(args.slice(0,7))}},'@/lib/tenant':{getCurrentUser:async()=>({id:'u',hotelId:'h'})},'@/server/errors':{PublicError,toErrorMessage:e=>e.message},'@/server/types':{ok,fail},'@/lib/reservations/operation':operations,'@/lib/security/money':money};
  return {api:load('src/server/actions/finance.ts',mocks),state:()=>state};
}
function payment(key='12345678-1234-4123-8123-123456789abc',amount='1000.29') {const f=new FormData();for(const [k,v]of Object.entries({operationKey:key,reservationId:'r',type:'PAYMENT',method:'CASH',amount,occurredAt:'2026-10-19'}))f.set(k,v);return f;}
test('financial retry creates exactly one row and audit',async()=>{const f=financeFixture();await f.api.createFinancialOperationAction(payment());await f.api.createFinancialOperationAction(payment());assert.equal(f.state().rows.length,1);assert.equal(f.state().audits.length,1);assert.equal(f.state().receipts.length,1)});
test('changed payload cannot reuse a finance operation key',async()=>{const f=financeFixture();await f.api.createFinancialOperationAction(payment());await assert.rejects(f.api.createFinancialOperationAction(payment(undefined,'2000')));assert.equal(f.state().rows.length,1)});
test('financial audit failure rolls back the business row and receipt',async()=>{const f=financeFixture(true);await assert.rejects(f.api.createFinancialOperationAction(payment()));assert.equal(f.state().rows.length,0);assert.equal(f.state().receipts.length,0)});
test('financial action requires a valid operation key',async()=>{const f=financeFixture();await assert.rejects(f.api.createFinancialOperationAction(payment('bad')));assert.equal(f.state().rows.length,0)});
test('batch capacity includes requested count',async()=>{const api=load('src/lib/billing/service.ts',{billingLaunch:()=>true,billingPlan:()=>({rooms:10,name:'Test'}),BillingError:Error},['assertRoomCapacity','lockBillingOrganization']);const tx={$queryRaw:async()=>[],hotel:{findUniqueOrThrow:async()=>({orgId:'o'})},billingSubscription:{findUnique:async()=>({planId:'pro'})},room:{count:async()=>9}};await api.assertRoomCapacity(tx,'h',1);await assert.rejects(api.assertRoomCapacity(tx,'h',5));});
test('production session cookie cannot be downgraded by APP_URL',()=>{const before={NODE_ENV:process.env.NODE_ENV,APP_URL:process.env.APP_URL};try{process.env.NODE_ENV='production';process.env.APP_URL='http://example.invalid';const api=load('src/lib/auth/session.ts',{},['shouldUseSecureSessionCookie']);assert.equal(api.shouldUseSecureSessionCookie(),true);}finally{for(const [k,v]of Object.entries(before)){if(v===undefined)delete process.env[k];else process.env[k]=v}}});
test('rotating chatId cannot reset the AI IP budget', async()=>{
  const before=process.env.AI_GATEWAY_API_KEY;process.env.AI_GATEWAY_API_KEY='local-test-not-a-secret';
  try {
    let calls=0;const buckets=new Map();
    const api=load('src/app/api/support/chat/route.ts',{
      ai:{generateText:async()=>{calls++;return {text:'ok'}},APICallError:{isInstance:()=>false}},
      '@/lib/auth/session':{getSessionUser:async()=>null},'@/lib/db':{db:{}},
      '@/lib/security/rate-limit':{enforceRateLimit:async(scope,id,limit)=>{const key=scope+id;const n=(buckets.get(key)||0)+1;buckets.set(key,n);if(n>limit)throw new RateLimitError()}},
      '@/server/errors':{RateLimitError},'@/lib/security/request-body':body,
      '@/lib/support/constants':{SUPPORT_ASSISTANT_PROMPT:'test',SUPPORT_CHAT_MAX_MESSAGE_LENGTH:2000,SUPPORT_CHAT_MAX_MESSAGES:20},
    });
    for(let i=0;i<31;i++) {
      const response=await api.POST(new Request('https://test.invalid/api/support/chat',{method:'POST',body:JSON.stringify({chatId:`different-chat-${i}`,messages:[{role:'user',content:'test'}]})}));
      assert.equal(response.status,i<30?200:429);
    }
    assert.equal(calls,30);
  } finally {if(before===undefined)delete process.env.AI_GATEWAY_API_KEY;else process.env.AI_GATEWAY_API_KEY=before;}
});
for(const initial of ['MAINTENANCE','OUT_OF_ORDER','CLEANING','OCCUPIED']) test(`cancellation preserves operational state ${initial}`, async()=>{
  let roomStatus=initial;
  const current={id:'r',hotelId:'h',roomId:'room',roomTypeId:'type',status:'CONFIRMED',checkIn:new Date('2026-11-01'),checkOut:new Date('2026-11-02')};
  const tx={reservation:{findFirst:async()=>current,update:async()=>({...current,status:'CANCELLED'}),count:async()=>0},hotel:{findUniqueOrThrow:async()=>({timezone:'Asia/Almaty'})},room:{updateMany:async({where,data})=>{if(where.status===roomStatus)roomStatus=data.status;return {count:1}}}};
  const api=load('src/lib/reservations/service.ts',{
    inReservationTransaction:async(_options,work)=>work(tx),lockBusinessKeys:async()=>{},
    ALLOWED_STATUS_TRANSITIONS:{CONFIRMED:['CANCELLED']},ACTIVE_RESERVATION_STATUSES:['PENDING','CONFIRMED','CHECKED_IN'],
    ROOM_STATUS_BY_RESERVATION_STATUS:{CHECKED_IN:'OCCUPIED',CHECKED_OUT:'CLEANING'},
    todayInTimeZone:zone=>{assert.equal(zone,'Asia/Almaty');return new Date('2026-10-19')},
    recomputeAvailability:async()=>{},enqueueHotelChannelSyncs:async()=>{},writeAudit:async()=>{},PublicError,
    reservationReference:()=> 'B1',
  },['setReservationStatus']);
  await api.setReservationStatus('h','r','CANCELLED');assert.equal(roomStatus,initial==='OCCUPIED'?'AVAILABLE':initial);
});
for (const status of ['succeed','fail']) test(`Channex ${status} cannot finalize a reclaimed lease`,async()=>{
  let writes=0;
  const tx={$queryRaw:async()=>[],channexSyncJob:{findUniqueOrThrow:async()=>({status:'RUNNING',lockedBy:'new-worker',rerunRequested:false}),update:async()=>{writes++}},channexBookingRevision:{count:async()=>0}};
  const api=load('src/lib/channels/channex/sync-worker.ts',{db:{$transaction:async fn=>fn(tx)},safeFailure:()=>({code:'NETWORK',message:'test',retryable:true})},[status]);
  const result=status==='succeed'?await api.succeed({id:'j',propertyRefId:'p'},[],'old-worker'):await api.fail({id:'j',propertyRefId:'p'},new Error('fault'),'old-worker');
  assert.equal(result,'superseded');assert.equal(writes,0);
});
test('Channex finalization preserves a requested rerun',async()=>{
  let next;
  const tx={$queryRaw:async()=>[],channexSyncJob:{findUniqueOrThrow:async()=>({status:'RUNNING',lockedBy:'worker',rerunRequested:true}),update:async({data})=>{next=data}},channexBookingRevision:{count:async()=>0},channexProperty:{update:async()=>{}}};
  const api=load('src/lib/channels/channex/sync-worker.ts',{db:{$transaction:async fn=>fn(tx)}},['succeed']);
  assert.equal(await api.succeed({id:'j',propertyRefId:'p'},[],'worker'),'retried');assert.equal(next.status,'PENDING');assert.equal(next.attempts,0);
});
test('identifier-only rate limit is shared across IP addresses',async()=>{
  let ip='192.0.2.1';const buckets=new Map();
  const tx={$queryRaw:async()=>[],rateLimitBucket:{findUnique:async({where})=>buckets.get(where.key),upsert:async({where,create})=>buckets.set(where.key,create),update:async({where})=>buckets.get(where.key).count++}};
  const api=load('src/lib/security/rate-limit.ts',{'next/headers':{headers:async()=>new Headers({'x-real-ip':ip})},'@/lib/db':{db:{$transaction:async fn=>fn(tx),rateLimitBucket:{deleteMany:async()=>{}}}},'@/server/errors':{RateLimitError}});
  await api.enforceRateLimit('account','user',1,60000,{identity:'identifier'});ip='192.0.2.2';
  await assert.rejects(api.enforceRateLimit('account','user',1,60000,{identity:'identifier'}));
});
test('unverified phone registration is rejected before provisioning',async()=>{
  let provisioned=false;
  const api=load('src/server/actions/auth.ts',{
    registerSchema:{safeParse:()=>({success:true,data:{method:'phone',phone:'+77001234567'}})},
    ensureDatabaseReady:async()=>{provisioned=true},fail,toErrorMessage:e=>e.message,
  },['registerAction']);
  const result=await api.registerAction({method:'phone'});assert.equal(result.ok,false);assert.equal(provisioned,false);
});
