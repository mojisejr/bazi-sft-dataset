// scripts/extract-divine-deep.cjs — Google Doc ไพ่จิตวิญญาณแดนสวรรค์ (ซินแสนุ้ย, export .txt) → src/lib/bazi/data/divine-cards-deep.json
// ใช้: node scripts/extract-divine-deep.cjs <in.txt> <out.json>
const fs=require('fs');
const L=fs.readFileSync(process.argv[2],'utf8').replace(/^\uFEFF/,'').replace(/\r/g,'').split('\n');
const KEYS=['oracle','general','wealth','work','health','family','love','emotion','material'];
const cards=[];let c=null,mode=null,sec=null,love=null;
const clean=s=>s.replace(/^\s*\*\s*/,'').trim();
for(const raw of L){
  const line=raw.replace(/\u00a0/g,' ');
  if(!line.trim()||/^_+$/.test(line.trim()))continue;
  let m=line.match(/^(\d{1,2})\.(?!\s)(\S.*)$/);
  if(m&&!/^\s/.test(line)){c={no:+m[1],name:m[2].trim(),history:[],sections:{},summary:[]};cards.push(c);mode=null;continue}
  if(!c)continue;
  const t=line.trim();
  if(/^ข้อมูลพื้นฐาน/.test(t)){mode='basic';continue}
  if(/^เบื้องหลังทางประวัติ/.test(t)){mode='history';continue}
  if(/^บท(บรรยาย|วิเคราะห์)/.test(t)){mode='topics';continue}
  if(/^สรุปภาพรวม/.test(t)){mode='summary';continue}
  m=t.match(/^([1-9])\.\s+/);
  if(mode==='topics'&&m&&!/^\s/.test(line)){sec=KEYS[+m[1]-1];love=null;c.sections[sec]=sec==='love'?{couple:[],single:[]}:[];continue}
  if(mode==='history')c.history.push(clean(t));
  else if(mode==='summary')c.summary.push(clean(t));
  else if(mode==='topics'&&sec){
    if(sec==='love'){ if(/แบบคนมีคู่/.test(t)&&t.length<20){love='couple';continue} if(/แบบคนโสด/.test(t)&&t.length<20){love='single';continue}
      (c.sections.love[love||'couple']).push(clean(t)); }
    else c.sections[sec].push(clean(t));
  }
}
const out={};const probs=[];
for(const k of cards){
  const S=k.summary.join(' ');const pp=S.match(/บวก[\s:(]*(\d{1,3})\s*%/),nn=S.match(/ลบ[\s:(]*(\d{1,3})\s*%/);const pol=pp&&nn?[0,pp[1],nn[1]]:[];
  const sections={};for(const s of KEYS){const v=k.sections[s];if(!v){probs.push(k.no+' missing '+s);continue}
    sections[s]=s==='love'?{couple:v.couple.join('\n'),single:v.single.join('\n')}:v.join('\n');
    if(s==='love'&&(!v.couple.length||!v.single.length))probs.push(k.no+' love part missing');}
  out[k.no]={name:k.name,history:k.history.join('\n'),sections,summary:k.summary.join('\n'),positive:pol[1]?+pol[1]:null,negative:pol[2]?+pol[2]:null};
  if(!pol[1])probs.push(k.no+' no polarity');
}
console.log('cards',cards.length,'nos',cards.map(c=>c.no).join(',').slice(0,400));console.log('problems',probs);
fs.writeFileSync(process.argv[3],JSON.stringify(out));
