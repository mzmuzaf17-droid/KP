// Minimal OOXML export, with embedded PNG images and a standards-compliant ZIP.
// All inputs come from the escaped contract preview, not executable HTML.
const enc=new TextEncoder();
const xml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const CRC_TABLE=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=(n&1)?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
const crc32=b=>{let crc=0xffffffff;for(const v of b)crc=CRC_TABLE[(crc^v)&255]^(crc>>>8);return (crc^0xffffffff)>>>0;};
export function zipStore(files) {
  const chunks=[],central=[];let offset=0;
  const header=(size,fill)=>{const b=new Uint8Array(size);fill(new DataView(b.buffer));return b;};
  for(const [name,raw] of Object.entries(files)) {
    const n=enc.encode(name),data=typeof raw==='string'?enc.encode(raw):raw,crc=crc32(data);
    const local=header(30,v=>{v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x800,true);v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,n.length,true);});
    chunks.push(local,n,data);
    central.push(header(46,v=>{v.setUint32(0,0x02014b50,true);v.setUint16(4,20,true);v.setUint16(6,20,true);v.setUint16(8,0x800,true);v.setUint32(16,crc,true);v.setUint32(20,data.length,true);v.setUint32(24,data.length,true);v.setUint16(28,n.length,true);v.setUint32(42,offset,true);}),n);
    offset+=local.length+n.length+data.length;
  }
  const size=central.reduce((n,b)=>n+b.length,0),count=Object.keys(files).length;
  const end=header(22,v=>{v.setUint32(0,0x06054b50,true);v.setUint16(8,count,true);v.setUint16(10,count,true);v.setUint32(12,size,true);v.setUint32(16,offset,true);});
  return new Blob([...chunks,...central,end],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
}
async function pngImage(src) {
  const image=new Image();image.src=src;await image.decode();
  const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
  canvas.getContext('2d').drawImage(image,0,0);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
  if(!blob)throw new Error('Rasmni eksport qilib bo‘lmadi.');
  return {bytes:new Uint8Array(await blob.arrayBuffer()),ratio:canvas.height/canvas.width};
}
export async function contractDocxFiles(root, imageLoader = pngImage) {
  const files={},images=new Map(),rels=[];
  for(const img of root.querySelectorAll('img')) {
    const src=img.getAttribute('src');if(images.has(src))continue;
    const data=await imageLoader(src),i=images.size+1,name=`image${i}.png`,id=`rIdImage${i}`;
    files['word/media/'+name]=data.bytes;images.set(src,{...data,id});
    rels.push(`<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${name}"/>`);
  }
  let drawingId=0;
  function imageXml(img) {
    const data=images.get(img.getAttribute('src'));const id=++drawingId;
    const width=(img.classList.contains('contract-stamp')?32:35)*36000,height=Math.round(width*data.ratio);
    return `<w:p><w:pPr><w:keepLines/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${width}" cy="${height}"/><wp:docPr id="${id}" name="Image ${id}" descr="${xml(img.alt)}"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${id}" name="Image ${id}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${data.id}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${width}" cy="${height}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
  }
  const runs=(node,bold=false)=>Array.from(node.childNodes).map(n=>n.nodeType===3?`<w:r>${bold?'<w:rPr><w:b/></w:rPr>':''}<w:t xml:space="preserve">${xml(n.textContent)}</w:t></w:r>`:n.tagName==='BR'?'<w:r><w:br/></w:r>':runs(n,bold||['STRONG','B'].includes(n.tagName))).join('');
  const borders=names=>names.map(n=>`<w:${n} w:val="single" w:sz="4" w:color="999999"/>`).join('');
  function table(node,parties=false) {
    const rows=parties?[Array.from(node.children)]:Array.from(node.querySelectorAll(':scope > thead > tr, :scope > tbody > tr, :scope > tr')).map(r=>Array.from(r.children));
    const count=rows[0]?.length||1,widths=parties?[4800,4800]:count===5?[480,3900,1350,2400,1470]:[480,2900,3100,3120];
    return `<w:tbl><w:tblPr><w:tblW w:w="9600" w:type="dxa"/>${parties?'':`<w:tblBorders>${borders(['top','left','bottom','right','insideH','insideV'])}</w:tblBorders>`}<w:tblCellMar><w:top w:w="70" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:bottom w:w="70" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths.map(w=>`<w:gridCol w:w="${w}"/>`).join('')}</w:tblGrid>${rows.map(row=>`<w:tr><w:trPr><w:cantSplit/>${row[0]?.tagName==='TH'?'<w:tblHeader/>':''}</w:trPr>${row.map((cell,i)=>`<w:tc><w:tcPr><w:tcW w:w="${widths[i]||1800}" w:type="dxa"/>${cell.tagName==='TH'?'<w:shd w:fill="EEEEEE"/>':''}</w:tcPr>${parties?Array.from(cell.children).map(block).join(''):`<w:p><w:pPr><w:spacing w:after="40"/></w:pPr>${runs(cell,cell.tagName==='TH')}</w:p>`}</w:tc>`).join('')}</w:tr>`).join('')}</w:tbl><w:p><w:pPr><w:spacing w:after="80"/></w:pPr></w:p>`;
  }
  function block(node) {
    if(node.nodeType!==1)return '';
    if(node.tagName==='IMG')return imageXml(node);
    if(node.tagName==='TABLE')return table(node);
    if(node.classList.contains('contract-parties'))return table(node,true);
    if(node.classList.contains('contract-annex'))return Array.from(node.children).map((child,i)=>i===0?block(child).replace('<w:pPr>','<w:pPr><w:pageBreakBefore/>'):block(child)).join('');
    if(node.classList.contains('contract-date'))return `<w:p><w:pPr><w:tabs><w:tab w:val="right" w:pos="9600"/></w:tabs></w:pPr><w:r><w:t>${xml(node.children[0].textContent)}</w:t><w:tab/><w:t>${xml(node.children[1].textContent)}</w:t></w:r></w:p>`;
    if(['P','H1','H2','H3'].includes(node.tagName)){
      const heading=node.tagName!=='P';return `<w:p><w:pPr>${heading?'<w:keepNext/><w:keepLines/>':''}<w:widowControl/><w:jc w:val="${heading?'center':node.classList.contains('contract-annex-heading')?'right':'both'}"/><w:spacing w:before="${heading?'100':'0'}" w:after="100" w:line="264" w:lineRule="auto"/></w:pPr>${runs(node,heading)}</w:p>`;
    }
    return Array.from(node.children).map(block).join('');
  }
  files['word/document.xml']=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${W}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body>${Array.from(root.children).map(block).join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1000" w:bottom="1000" w:left="1134" w:right="1134" w:header="0" w:footer="0"/></w:sectPr></w:body></w:document>`;
  files['word/styles.xml']=`<?xml version="1.0"?><w:styles xmlns:w="${W}"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="22"/><w:color w:val="000000"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>`;
  files['word/_rels/document.xml.rels']=`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${rels.join('')}</Relationships>`;
  files['_rels/.rels']='<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>';
  files['[Content_Types].xml']='<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>';
  return files;
}
export async function downloadContractDocx(root,state) {
  const files=await contractDocxFiles(root),blob=zipStore(files),url=URL.createObjectURL(blob),a=document.createElement('a');
  const safe=String(state.agency||'mijoz').replace(/[^\p{L}\p{N}_-]/gu,'-').slice(0,80);
  a.download=`Shartnoma_${safe}_${state.contract?.number?.replace(/[^\p{L}\p{N}_-]/gu,'-')||'raqamsiz'}.docx`;a.href=url;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
