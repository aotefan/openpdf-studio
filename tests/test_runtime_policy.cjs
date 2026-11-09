const {test}=require('node:test');const assert=require('node:assert/strict');const {patched}=require('../scripts/check-runtime.cjs');
test('reject below-baseline, unsupported and invalid runtime versions',()=>{for(const v of ['24.22.0','24.22.1','22.23.4','26.12.1','20.20.0','24.x.1','27.0.0'])assert.equal(patched(v),false,v)});
test('accept reviewed runtime releases',()=>{for(const v of ['24.22.2','26.13.0','v24.23.0'])assert.equal(patched(v),true,v)});
