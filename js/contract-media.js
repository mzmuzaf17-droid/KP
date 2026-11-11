// Local DOCX import only. Neither the file, banking details nor images leave the browser.
export function docxEntries(bytes) {
  if(bytes.length<22)throw new Error('DOCX fayli ochilmadi.');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),text=new TextDecoder();let end=-1;
  for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(view.getUint32(i,true)===0x06054b50){end=i;break;}
  if(end<0)throw new Error('DOCX fayli ochilmadi.');
  const count=view.getUint16(end+10,true),offset=view.getUint32(end+16,true);
  if(count>2048)throw new Error('DOCX fayli juda murakkab.');
  let cursor=offset;const entries=[];
  for(let i=0;i<count;i++){
    if(cursor+46>bytes.length||view.getUint32(cursor,true)!==0x02014b50)throw new Error('DOCX arxivi buzilgan.');
    const nameLen=view.getUint16(cursor+28,true),extra=view.getUint16(cursor+30,true),comment=view.getUint16(cursor+32,true);
    entries.push({name:text.decode(bytes.subarray(cursor+46,cursor+46+nameLen)),flags:view.getUint16(cursor+8,true),method:view.getUint16(cursor+10,true),compressed:view.getUint32(cursor+20,true),size:view.getUint32(cursor+24,true),offset:view.getUint32(cursor+42,true)});
    cursor+=46+nameLen+extra+comment;
  }
  return entries;
}
export function docxMediaEntry(bytes) {
  const entries=docxEntries(bytes).filter(e=>/^word\/media\/[^/]+\.(png|jpe?g|webp)$/i.test(e.name));
  if(entries.length!==1)throw new Error(entries.length?'Word faylida bir nechta rasm bor. Kerakli muhrni PNG/JPG qilib yuklang.':'Word faylida muhr rasmi topilmadi.');
  return entries[0];
}
async function unzipEntry(bytes,entry) {
  if(entry.flags&1||entry.size>2*1024*1024||entry.compressed>2*1024*1024)throw new Error('Word yozuvi shifrlangan yoki juda katta.');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(entry.offset+30>bytes.length||view.getUint32(entry.offset,true)!==0x04034b50)throw new Error('Word yozuvi buzilgan.');
  const start=entry.offset+30+view.getUint16(entry.offset+26,true)+view.getUint16(entry.offset+28,true);
  if(start+entry.compressed>bytes.length)throw new Error('Fayl ma’lumotlari to‘liq emas.');
  let data=bytes.slice(start,start+entry.compressed);
  if(entry.method===8){
    let stream;try{stream=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));}catch{throw new Error('Bu brauzer Word faylini ocholmadi. Rekvizitlarni qo‘lda kiriting.');}
    const reader=stream.getReader(),parts=[];let size=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2*1024*1024){await reader.cancel();throw new Error('Word yozuvi juda katta.');}parts.push(value);}}finally{reader.releaseLock();}
    data=new Uint8Array(await new Blob(parts).arrayBuffer());
  }else if(entry.method!==0)throw new Error('Word siqish formati qo‘llanmaydi.');
  if(data.length!==entry.size)throw new Error('Word yozuvi to‘liq ochilmadi.');return data;
}
async function localBytes(file) {if(file.size>10*1024*1024)throw new Error('10 MB dan kichik Word faylini tanlang.');return new Uint8Array(await file.arrayBuffer());}
async function stampFile(bytes,entry) {
  const data=await unzipEntry(bytes,entry),ext=entry.name.split('.').pop().toLowerCase();
  return new File([data],'muhr.'+ext,{type:ext==='png'?'image/png':ext==='webp'?'image/webp':'image/jpeg'});
}
export async function extractDocxStamp(file) {const bytes=await localBytes(file);return stampFile(bytes,docxMediaEntry(bytes));}
export function sellerFromParagraphs(paragraphs,intro='') {
  const text=paragraphs.map(p=>String(p).trim()).filter(Boolean);
  const val=label=>text.find(t=>t.startsWith(label+':'))?.slice(label.length+1).trim()||'';
  const seller={sellerCompany:text[1]||'',sellerAddress:val('Manzil'),sellerBank:val('Bank'),sellerAccount:val('H/r'),sellerMfo:val('MFO'),sellerStir:val('STIR'),sellerShort:val('Rahbar').replace(/_/g,'').trim()};
  seller.sellerDirector=intro.match(/direktor\s+(.+?)\s+bir tomondan/i)?.[1]?.trim()||seller.sellerShort;
  return Object.fromEntries(Object.entries(seller).filter(([,value])=>value));
}
export async function importContractTemplate(file) {
  const bytes=await localBytes(file),entries=docxEntries(bytes),entry=entries.find(e=>e.name==='word/document.xml');
  if(!entry)throw new Error('Word hujjati topilmadi.');
  const raw=new TextDecoder().decode(await unzipEntry(bytes,entry));const doc=new DOMParser().parseFromString(raw,'application/xml');
  if(doc.getElementsByTagName('parsererror').length)throw new Error('Word matni ochilmadi.');
  const ns='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const text=node=>Array.from(node.getElementsByTagNameNS(ns,'t')).map(t=>t.textContent).join('');
  const firstCell=doc.getElementsByTagNameNS(ns,'tc')[0];if(!firstCell)throw new Error('Namunaga mos rekvizitlar jadvali topilmadi.');
  const paras=Array.from(firstCell.getElementsByTagNameNS(ns,'p')).map(text);
  if(!paras[0]?.includes('Bajaruvchi'))throw new Error('Bajaruvchi rekvizitlari topilmadi.');
  const intro=Array.from(doc.getElementsByTagNameNS(ns,'p')).map(text).find(p=>p.includes('bir tomondan'))||'';
  const seller=sellerFromParagraphs(paras,intro);
  const images=entries.filter(e=>/^word\/media\/[^/]+\.(png|jpe?g|webp)$/i.test(e.name));
  if(images.length>1)throw new Error('Wordda bir nechta rasm bor. Rekvizitlarni qo‘lda, muhrni PNG qilib kiriting.');
  return {seller,stamp:images.length?await stampFile(bytes,images[0]):null};
}
