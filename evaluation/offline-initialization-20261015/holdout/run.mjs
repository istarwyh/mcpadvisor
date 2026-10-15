import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const [repo, mode, output, surface="engine"]=process.argv.slice(2);
if(!repo||!['sequential','concurrent'].includes(mode)||!output) throw new Error('usage: node run.mjs REPO sequential|concurrent OUTPUT');
const fixture=JSON.parse(fs.readFileSync(path.join(here,'holdout.json')));
const freeze=JSON.parse(fs.readFileSync(path.join(here,'FREEZE.json')));
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
for(const [name,hash] of Object.entries(freeze.files_sha256)) if(sha(fs.readFileSync(path.join(here,name)))!==hash) throw new Error('Frozen file changed: '+name);
const catalog=path.join(repo,'data/mcp_server_list.json');
if(sha(fs.readFileSync(catalog))!==fixture.catalog_sha256) throw new Error('Catalog differs from frozen baseline');
process.chdir(repo);
const imp=relative=>import(pathToFileURL(path.join(repo,'build',relative)).href);
const {EnhancedMemoryVectorEngine}=await imp('services/providers/offline/enhancedMemoryVectorEngine.js');
const {OfflineSearchProvider}=await imp('services/core/search/OfflineSearchProvider.js');
const {OfflineDataLoader}=await imp('services/providers/offline/offlineDataLoader.js');
const {getTextEmbedding}=await imp('utils/embedding.js');
const {normalizeVector}=await imp('utils/vectorUtils.js');
const report={mode,repo,surface,fixture_sha256:freeze.files_sha256['holdout.json'],started_at:new Date().toISOString(),cases:[],initializations:0,errors:[]};
const timer=setTimeout(()=>{report.errors.push('Cohort timeout after 60000 ms'); fs.writeFileSync(output,JSON.stringify(report,null,2)); process.exit(2);},60000);
const original=OfflineDataLoader.prototype.loadFallbackDataWithEmbeddings;
let gate=Promise.resolve();
OfflineDataLoader.prototype.loadFallbackDataWithEmbeddings=async function(...args){report.initializations++; await gate; return original.apply(this,args);};
try {
 const vectors=[];
 if(surface==="engine") for(const c of fixture.cases) vectors.push(normalizeVector(await getTextEmbedding(c.query)));
 const construct=()=>surface==="provider"?new OfflineSearchProvider({fallbackDataPath:catalog,minSimilarity:fixture.options.minSimilarity}):new EnhancedMemoryVectorEngine(catalog);
 const engine=construct();
 const invoke=(instance,i)=>surface==="provider"?instance.search(fixture.cases[i].query):instance.search(vectors[i],fixture.options.limit,{minSimilarity:fixture.options.minSimilarity,textQuery:fixture.cases[i].query});
 const identify=r=>({id:r.id??null,sourceUrl:r.sourceUrl,title:r.title,score:r.score??null,similarity:r.similarity??null});
 const record=(rows,i)=>{
  const c=fixture.cases[i];
  const returned_count=rows.length; rows=rows.slice(0,fixture.options.limit);
  const rank=rows.findIndex(r=>c.known_positive_catalog_ids.includes(r.id)||c.known_positive_source_urls.includes(r.sourceUrl));
  return {case_id:c.case_id,query:c.query,returned_count,hit_at_5:rank>=0?1:0,reciprocal_rank:rank>=0?1/(rank+1):0,rows:rows.map(identify)};
 };
 if(mode==='sequential') {
  for(let i=0;i<fixture.cases.length;i++) report.cases.push(record(await invoke(engine,i),i));
 } else {
  let release; gate=new Promise(resolve=>{release=resolve;});
  const pending=fixture.cases.map((_,i)=>invoke(engine,i));
  // All requests have been dispatched in one tick. The gate enforces overlap without assuming a loader count.
  await new Promise(resolve=>setImmediate(resolve)); release();
  const settled=await Promise.allSettled(pending);
  settled.forEach((r,i)=>{if(r.status==='fulfilled') report.cases.push(record(r.value,i)); else report.errors.push({case_id:fixture.cases[i].case_id,error:String(r.reason)});});
  report.first_access_initializations=report.initializations;
  gate=Promise.resolve();
  const beforeWarm=report.initializations;
  report.warm_cases=[record(await invoke(engine,0),0),record(await invoke(engine,11),11)];
  report.additional_warm_initializations=report.initializations-beforeWarm;
  const beforeIndependent=report.initializations;
  const independent=construct();
  await Promise.all([invoke(independent,0),invoke(independent,11)]);
  report.independent_scope_initializations=report.initializations-beforeIndependent;
 }
 report.mean_hit_at_5=report.cases.reduce((a,c)=>a+c.hit_at_5,0)/fixture.cases.length;
 report.mean_reciprocal_rank=report.cases.reduce((a,c)=>a+c.reciprocal_rank,0)/fixture.cases.length;
} catch(e){report.errors.push(String(e?.stack??e));}
finally{OfflineDataLoader.prototype.loadFallbackDataWithEmbeddings=original;clearTimeout(timer); report.finished_at=new Date().toISOString();fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({mode,output,initializations:report.initializations,hit:report.mean_hit_at_5,errors:report.errors}));
process.exit(report.errors.length?1:0);
