const {test}=require('node:test');const assert=require('node:assert/strict');const {patched}=require('../scripts/check-runtime.cjs');
test('reject affected, unsupported and invalid runtime versions',()=>{for(const v of ['24.22.0','22.23.3','26.12.0','20.20.0','24.x.1','27.0.0'])assert.equal(patched(v),false,v)});
test('accept reviewed patched releases',()=>{for(const v of ['24.22.1','22.23.4','26.12.1','v24.23.0'])assert.equal(patched(v),true,v)});
