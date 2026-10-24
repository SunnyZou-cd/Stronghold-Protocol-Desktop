import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rewriteKitImports} from '../shared/kitImports.js';
import {resultDigest} from '../server/sim/spec.js';
test('block comments preserve source offsets when rewriting subsequent pack imports',()=>{
 const s="import { num } from '@battle/index.js';\n/** 中文 multiline\n * helper */\nconst x = 1;\nimport { COLS } from '@sim/constants.js';\nexport {x};";
 const result=rewriteKitImports(s,p=>'https://example.invalid/'+p);
 assert.ok(result.includes("from 'https://example.invalid/server/sim/constants.js'"));
 assert.ok(result.includes('const x = 1;'));
 assert.ok(result.includes('/** 中文 multiline'));
});
test('battle reward markers affect verification and absent markers preserve the vanilla digest',()=>{
 const base={reason:'cleared',time:1,perPlayer:{p1:{}}};
 const marked=structuredClone(base);marked.perPlayer.p1.marks={equipTier:1};
 assert.notEqual(resultDigest(base).hash,resultDigest(marked).hash);
 const empty=structuredClone(base);empty.perPlayer.p1.marks={};
 assert.equal(resultDigest(base).hash,resultDigest(empty).hash);
 marked.perPlayer.p1.marks.equipTier=null;
 assert.notEqual(resultDigest(base).hash,resultDigest(marked).hash);
});
