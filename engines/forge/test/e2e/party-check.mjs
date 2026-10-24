import puppeteer from 'puppeteer-core';
import assert from 'node:assert/strict';
import {Client} from './client.mjs';
const base=process.env.PARTY_BASE||'http://127.0.0.1:33000';
const clients=[new Client(puppeteer,base,'host',{prefix:'party'}),new Client(puppeteer,base,'friend',{w:1280,h:720,prefix:'party-friend'})];
const [h,f]=clients; const req=(c,t,v={})=>c.page.evaluate(async({t,v})=>globalThis.__SP__.net.request(t,v),{t,v});
const wait=async(c,fn,v)=>{await c.page.bringToFront();const end=Date.now()+90000;while(Date.now()<end){try{if(await c.page.evaluate(fn,v))return;}catch{}await new Promise(r=>setTimeout(r,250));}throw new Error('State wait timeout: '+fn.toString());};
try{
 await Promise.all(clients.map(c=>c.open()));await h.enter('Mod验收房主');await f.enter('Mod验收队友');
 await h.click('button','拓展');await h.page.waitForSelector('.friend-mod-grid');
 assert.equal(await h.page.$$eval('.friend-mod-cell input',els=>els.filter(e=>e.checked).length),0);
 assert.equal(await h.page.$eval('.friend-mod-grid',e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),3);
 await h.shot('lobby-3-columns');
 assert.equal(await h.page.$$eval('[data-mod-info]',els=>els.length),8);
 for(const id of ['rounds','rhine','relics','operators','damage','lucky','recruits','targeted']){
  const before=await h.page.$$eval('.friend-mod-cell input',els=>els.map(e=>e.checked));
  await h.click('[data-mod-info="'+id+'"]');await h.page.waitForSelector('.modal__title');
  assert.ok(await h.page.$eval('.modal__title',e=>e.textContent.length>1));await h.click('button','知道了');
  assert.deepEqual(await h.page.$$eval('.friend-mod-cell input',els=>els.map(e=>e.checked)),before);
 }
 console.log('PASS all eight lobby explanations without checkbox changes');
 await req(h,'room.create',{mode:'coop',difficulty:'NORMAL'});const code=await h.page.evaluate(()=>__SP__.store.get().room.code);await req(f,'room.join',{code});
 await wait(f,()=>!!document.querySelector('.room-options'));assert.equal(await h.page.$$eval('.room-options input[type=checkbox]',els=>els.length),8);assert.ok(await f.page.$$eval('.room-options input[type=checkbox]',els=>els.every(e=>e.disabled)));assert.equal(await h.page.$eval('.room-options',e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),3);
 for(const id of ['rounds','rhine','relics','operators','damage','lucky','recruits','targeted']){
  await f.click('[data-mod-info="'+id+'"]');await f.page.waitForSelector('.modal__title');await f.click('button','知道了');
 }
 console.log('PASS all eight guest explanations');
 for(const mod of ['relics','operators','damage','lucky','recruits','targeted']){
  await req(f,'room.ready',{ready:true});await h.click(`[data-testid="${mod}-toggle"] input`);
  await wait(f,key=>__SP__.store.get().room[key]===true,mod+'Enabled');
  assert.equal(await f.page.evaluate(()=>__SP__.store.get().room.seats.find(p=>p?.playerId===__SP__.store.get().me.playerId).ready),false);
 }
 await wait(f,()=>__SP__.data.profileId==='vanilla-extra-custom'&&__SP__.store.get().ui.dataReady===true);
 assert.ok(await f.page.evaluate(()=>__SP__.data.get('chess','chess_char_5_makoto_a')));
 await h.click('[data-testid="rhine-toggle"] input');await wait(f,()=>__SP__.data.profileId==='rhine-extra-custom'&&__SP__.store.get().ui.dataReady===true);
 await h.click('[data-testid="extra-rounds-toggle"] input');await h.shot('waiting-3-columns');
 await h.page.setViewport({width:900,height:600});assert.equal(await h.page.$eval('.room-options',e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),2);await h.shot('waiting-2-columns');
 await h.page.setViewport({width:390,height:844});assert.equal(await h.page.$eval('.room-options',e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),1);await h.shot('waiting-mobile');await h.page.setViewport({width:844,height:390});await h.click('[data-mod-info="recruits"]');await h.page.waitForSelector('.modal__title');await h.shot('mobile-mod-info');await h.click('button','知道了');await h.page.setViewport({width:1920,height:1080});
 console.log('reload friend'); await f.page.reload({waitUntil:'domcontentloaded'}); console.log('reload loaded'); await wait(f,()=>__SP__?.store.get().room?.operatorsEnabled===true&&__SP__.store.get().ui.dataReady===true);
 assert.ok(await f.page.evaluate(()=>__SP__.store.get().room.recruitsEnabled&&__SP__.store.get().room.luckyEnabled&&__SP__.store.get().room.targetedEnabled));console.log('reconnected friend; starting'); await req(f,'room.ready',{ready:true});await req(h,'room.start');await wait(h,()=>__SP__.store.get().match.public?.operatorsEnabled===true);
 assert.equal(await h.page.evaluate(()=>__SP__.store.get().match.public.players.filter(p=>p.luckyChess).length),2);assert.ok(await h.page.$('.lucky-opening'));await h.shot('lucky-opening');await req(h,'g.infoReady');await req(f,'g.infoReady');
 for(let i=0;i<50;i++){for(const c of clients){const phase=await c.page.evaluate(()=>__SP__.store.get().match.public?.phase);if(phase==='BAND_DRAFT')try{await req(c,'g.band',{bandId:'band_bldsk'});}catch{} }if(await h.page.$('.gm'))break;await new Promise(r=>setTimeout(r,200));}
 await wait(h,()=>!!document.querySelector('.gm'));
 await wait(h,()=>__SP__.store.get().match.public?.phase==='PREP');
 for(const c of clients)await req(c,'g.autoplay',{on:true});
 await wait(h,()=>__SP__.store.get().match.public?.phase==='COMBAT'&&__SP__.store.get().match.damage?.owners?.some(p=>p.total>0));
 await h.click('button','返回模拟'); await h.click('.damage-board__toggle');assert.ok(await h.page.$eval('.damage-board__panel',e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})); await h.shot('match-all-mods');
 await f.page.evaluate(()=>__SP__.net.reconnectNow());
 await wait(f,()=>__SP__.store.get().connection.status==='online'&&__SP__.store.get().match.damage?.owners?.length>0);
 assert.ok(await f.page.evaluate(()=>__SP__.store.get().match.public.operatorsEnabled&&__SP__.store.get().match.public.damageEnabled));
 assert.ok(await f.page.evaluate(()=>__SP__.store.get().match.public.recruitsEnabled&&__SP__.store.get().match.public.targetedEnabled));console.log('PASS: eight flags, live damage UI and match reconnect');
 console.log('PASS: defaults, multi-columns, host choices, profile synchronization, readiness, room reconnect and match rendering');
 console.log(JSON.stringify(clients.map(c=>({label:c.label,problems:c.problems.filter(p=>!p.includes('net::ERR_ABORTED'))})),null,2));
} catch(e) { console.error(e); for(const c of clients){try{console.log(c.label,await c.st());console.log(await c.page.evaluate(()=>({room:__SP__.store.get().room,ui:__SP__.store.get().ui,profile:__SP__.data.profileId})));await c.shot('failure');}catch{}} throw e; } finally {for(const c of clients){try{await Promise.race([req(c,'g.leave'),new Promise(r=>setTimeout(r,3000))]);await Promise.race([req(c,'room.leave'),new Promise(r=>setTimeout(r,3000))]);}catch{}await c.close();}}
