import fs from 'node:fs';
import path from 'node:path';
const dir=process.argv[2];
const read=n=>JSON.parse(fs.readFileSync(path.join(dir,n+'.json')));
const bs=read('baseline-sequential'),bc=read('baseline-concurrent'),cs=read('candidate-sequential'),cc=read('candidate-concurrent');
const eq=(a,b)=>a.length===b.length&&a.every((r,i)=>['id','sourceUrl','title'].every(k=>r[k]===b[i][k])&&['score','similarity'].every(k=>r[k]===b[i][k]||(typeof r[k]==='number'&&typeof b[i][k]==='number'&&Math.abs(r[k]-b[i][k])<=1e-12)));
const failures=[];
for(const r of [bs,bc,cs,cc]) if(r.errors.length) failures.push({cohort:r.repo+' '+r.mode,errors:r.errors});
for(const c of bs.cases){const s=cs.cases.find(x=>x.case_id===c.case_id),v=cc.cases.find(x=>x.case_id===c.case_id),b=bc.cases.find(x=>x.case_id===c.case_id);
 if(!s||!eq(c.rows,s.rows))failures.push(c.case_id+': baseline/candidate sequential outputs differ');
 if(s&&(s.hit_at_5<c.hit_at_5||s.reciprocal_rank<c.reciprocal_rank))failures.push(c.case_id+': known positive quality regressed');
 if(!v||!s||!eq(s.rows,v.rows))failures.push(c.case_id+': candidate concurrent/warm outputs differ');
 if(!b||!eq(c.rows,b.rows))failures.push(c.case_id+': baseline concurrent/sequential outputs differ');
}
for(const w of cc.warm_cases??[]){const s=cs.cases.find(x=>x.case_id===w.case_id);if(!s||!eq(s.rows,w.rows))failures.push(w.case_id+': candidate subsequent warm output differs');}
if(cc.first_access_initializations!==1)failures.push('Candidate first access initializes '+cc.first_access_initializations+' times');
if(cc.additional_warm_initializations!==0)failures.push('Candidate warm access reinitializes');
if(cc.independent_scope_initializations!==1)failures.push('Candidate second independent scope initializes '+cc.independent_scope_initializations+' times');
const result={pass:failures.length===0,failures,baseline:{hit_at_5:bs.mean_hit_at_5,mrr:bs.mean_reciprocal_rank,first_access_initializations:bc.first_access_initializations},candidate:{hit_at_5:cs.mean_hit_at_5,mrr:cs.mean_reciprocal_rank,first_access_initializations:cc.first_access_initializations,warm_initializations:cc.additional_warm_initializations,independent_scope_initializations:cc.independent_scope_initializations},baseline_misses:bs.cases.filter(c=>!c.hit_at_5).map(c=>c.case_id),scope:'Frozen catalog-derived 12-case engine holdout; fixed fallback mode; no ranking or model tuning.'};
fs.writeFileSync(path.join(dir,'comparison.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));process.exit(result.pass?0:1);
