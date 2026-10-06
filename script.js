'use strict';
const STORES=["DPK","BGR","CBN","TLC","CNR","SHL","KDI","PRS","PYM"];
const MONTHS=["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const COLS=[["t","Target (T)"],["a","Actual (A)"],["pct","%"],["ly","LY"],["mt","MTD Target"],["ma","MTD Actual"],["mpct","%"],["mly","MTD LY"],["gr","Growth"]];
const KEYS=["t","a","ly","mt","ma","mly"];
const state={date:"",time:"",stores:{},excelFiles:[],excelData:[],mergedData:[]};
const view={q:"",store:"",sort:null,asc:true,page:0,size:50};
const $=s=>document.querySelector(s);
const isNum=v=>typeof v==="number"&&isFinite(v);

function toast(m,err){const t=$("#toast");t.textContent=m;t.className="toast show"+(err?" err":"");clearTimeout(toast.h);toast.h=setTimeout(()=>t.className="toast",2600)}
function setStatus(el,m,c){el.textContent=m;el.className="status "+(c||"")}
function parseNumber(v){
  if(v==null)return null;let s=String(v).replace(/[^\d.,-]/g,"");if(!/\d/.test(s))return null;
  const neg=s.startsWith("-");s=s.replace(/-/g,"");const d=s.lastIndexOf("."),c=s.lastIndexOf(",");
  if(d>-1&&c>-1){const dec=d>c?".":",";const th=dec==="."?",":".";s=s.split(th).join("").replace(dec,".")}
  else{const sep=d>-1?".":c>-1?",":null;if(sep){const parts=s.split(sep);
    if(parts.length>2||(parts.length===2&&parts[1].length===3&&parts[0].length<=3&&parts[0]!=="0"))s=parts.join("");else s=parts.join(".")}}
  const n=parseFloat(s);return isFinite(n)?(neg?-n:n):null}
function parsePercent(v){if(v==null)return null;const m=String(v).match(/-?[\d.,]+\s*%/);return m?parseNumber(m[0]):null}
function calculateAchievement(a,t){return isNum(a)&&isNum(t)&&t!==0?a/t*100:null}
function calculateGrowth(a,ly){return isNum(a)&&isNum(ly)&&ly!==0?(a-ly)/ly*100:null}
function parseWhatsAppReport(text){
  const r={t:null,a:null,ly:null,mt:null,ma:null,mly:null,sel:null,bsz:null,ffc:null,grRaw:null,monthTarget:null};
  if(!text||!text.trim())return null;
  for(const raw of text.split(/\r?\n/)){
    const l=raw.replace(/[*_~`]/g,"").trim();if(!l)continue;
    const val=()=>{const i=l.search(/[:=]/);return i>-1?l.slice(i+1):l.replace(/^[A-Za-z\s\/]+/,"")};
    const pair=l.match(/([\d.,]+)\s*\/\s*([\d.,]+)/);
    if(/MTD\s*LY/i.test(l)){r.mly=parseNumber(val())}
    else if(/MTD\s*T\s*\/\s*A/i.test(l)&&pair){r.mt=parseNumber(pair[1]);r.ma=parseNumber(pair[2])}
    else if(/\bT\s*\/\s*A\b/i.test(l)&&pair){r.t=parseNumber(pair[1]);r.a=parseNumber(pair[2])}
    else if(/^\W*target/i.test(l)&&!/\//.test(l)){r.monthTarget=parseNumber(val())}
    else if(/^\W*SEL\b/i.test(l)){if(r.sel==null)r.sel=parseNumber(val())}
    else if(/^\W*BSZ\b/i.test(l)){r.bsz=parseNumber(val())}
    else if(/^\W*FFC\b/i.test(l)){r.ffc=parseNumber(val())}
    else if(/^\W*LY\b/i.test(l)){r.ly=parseNumber(val())}
    else if(/growth|^\W*gr\b/i.test(l)){r.grRaw=parseNumber(val().replace("%",""))}
  }
  return KEYS.some(k=>r[k]!=null)?r:null}
function calc(s){
  const g=calculateGrowth(s.ma,s.mly);
  return {pct:calculateAchievement(s.a,s.t),mpct:calculateAchievement(s.ma,s.mt),gr:g!=null?g:(isNum(s.grRaw)?s.grRaw:null)}}
function calculateRegionTotal(data){
  const T={};KEYS.forEach(k=>{const v=STORES.map(x=>data[x]&&data[x][k]).filter(isNum);T[k]=v.length?v.reduce((a,b)=>a+b,0):null});
  return Object.assign(T,calc(T),{grRaw:null})}
const f0=v=>isNum(v)?Math.round(v).toLocaleString("id-ID"):"-";
const fp=(v,d)=>isNum(v)?v.toFixed(d)+"%":"-";
function fmtDate(d){if(!d)return"-";const[y,m,x]=d.split("-");return`${x}-${MONTHS[+m-1]}-${y}`}

function renderTable(data){
  const tb=$("#editTable");let h="<thead><tr><th>STORE</th>"+COLS.map(c=>`<th>${c[1]}</th>`).join("")+"</tr></thead><tbody>";
  STORES.forEach(st=>{const s=data[st];const c=s?calc(s):{};
    h+=`<tr><td>${st}</td>`+COLS.map(([k])=>{
      if(KEYS.includes(k))return`<td><input data-s="${st}" data-k="${k}" inputmode="decimal" value="${s&&isNum(s[k])?s[k]:""}" placeholder="-"></td>`;
      return`<td data-c="${st}-${k}">${fp(c[k],k==="gr"?2:0)}</td>`}).join("")+"</tr>"});
  const T=calculateRegionTotal(data);
  h+="<tr class='tot'><td>TOTAL</td>"+COLS.map(([k])=>`<td data-c="TOT-${k}">${KEYS.includes(k)?f0(T[k]):fp(T[k],k==="gr"?2:0)}</td>`).join("")+"</tr></tbody>";
  tb.innerHTML=h}
function refreshComputed(){
  STORES.forEach(st=>{const s=state.stores[st];if(!s)return;const c=calc(s);["pct","mpct","gr"].forEach(k=>{const e=document.querySelector(`[data-c="${st}-${k}"]`);if(e)e.textContent=fp(c[k],k==="gr"?2:0)})});
  const T=calculateRegionTotal(state.stores);COLS.forEach(([k])=>{const e=document.querySelector(`[data-c="TOT-${k}"]`);if(e)e.textContent=KEYS.includes(k)?f0(T[k]):fp(T[k],k==="gr"?2:0)});
  renderWhatsAppOutput(state.stores);save()}
function renderWhatsAppOutput(data){
  const has=STORES.some(s=>data[s]);if(!has){$("#output").textContent="Belum ada data.";return}
  const p=(s,n,right)=>right?String(s).padStart(n):String(s).padEnd(n);
  const line=(n,c)=>p(n,6)+p(f0(c.t),8,1)+p(f0(c.a),8,1)+p(fp(c.pct,0),7,1)+p(fp(c.gr,2),9,1);
  let o=`Report Region 6\n${fmtDate(state.date)}\n🕒 ${state.time||"-"}\n\n\`\`\`${p("STORE",6)}${p("T",8,1)}${p("A",8,1)}${p("%",7,1)}${p("GROWTH",9,1)}\n`;
  STORES.forEach(st=>{const s=data[st];o+=line(st,s?Object.assign({},s,calc(s)):{})+"\n"});
  const T=calculateRegionTotal(data);o+=line("TOTAL",T)+"\n```";
  o+=`\n\nMTD Target: ${f0(T.mt)} | MTD Actual: ${f0(T.ma)} (${fp(T.mpct,2)})\nMTD LY: ${f0(T.mly)} | Growth Region: ${fp(T.gr,2)}`;
  $("#output").textContent=o}
function readInputs(){state.date=$("#date").value;state.time=$("#time").value;$("#dateLbl").textContent=fmtDate(state.date)}
function handleCalc(){
  readInputs();const filled=STORES.filter(s=>$("#ta-"+s).value.trim());
  if(!filled.length){setStatus($("#status"),"Belum ada data WA yang dimasukkan.","err");toast("Belum ada data laporan WA yang dimasukkan.",1);return}
  state.stores={};const bad=[];
  filled.forEach(s=>{try{const r=parseWhatsAppReport($("#ta-"+s).value);if(r)state.stores[s]=r;else bad.push(s)}catch(e){bad.push(s)}});
  const n=Object.keys(state.stores).length;
  setStatus($("#status"),`${n} dari 9 toko memiliki data.`+(bad.length?` Gagal dibaca: ${bad.join(", ")}.`:""),n===9?"ok":"warn");
  renderTable(state.stores);renderWhatsAppOutput(state.stores);save()}
async function copyWhatsAppReport(){
  const t=$("#output").textContent;if(t==="Belum ada data."){toast("Belum ada laporan untuk disalin",1);return}
  try{await navigator.clipboard.writeText(t)}catch(e){const a=document.createElement("textarea");a.value=t;document.body.appendChild(a);a.select();document.execCommand("copy");a.remove()}
  toast("Laporan berhasil disalin")}
function resetAll(){
  STORES.forEach(s=>$("#ta-"+s).value="");state.stores={};state.excelFiles=[];state.excelData=[];state.mergedData=[];
  localStorage.removeItem("r6");$("#file").value="";setStatus($("#status"),"");setStatus($("#xStatus"),"");
  renderTable({});renderWhatsAppOutput({});renderFiles();renderExcelPreview([]);setNow();toast("Semua data direset")}
function save(){try{localStorage.setItem("r6",JSON.stringify({date:$("#date").value,time:$("#time").value,stores:state.stores,texts:Object.fromEntries(STORES.map(s=>[s,$("#ta-"+s).value]))}))}catch(e){}}
function load(){try{const d=JSON.parse(localStorage.getItem("r6")||"null");if(!d)return false;
  $("#date").value=d.date||"";$("#time").value=d.time||"";STORES.forEach(s=>$("#ta-"+s).value=(d.texts||{})[s]||"");state.stores=d.stores||{};return true}catch(e){return false}}
function setNow(){const n=new Date(),p=x=>String(x).padStart(2,"0");$("#date").value=`${n.getFullYear()}-${p(n.getMonth()+1)}-${p(n.getDate())}`;$("#time").value=`${p(n.getHours())}:${p(n.getMinutes())}`;readInputs()}

/* ===== EXCEL ===== */
function detectStore(name,rows){
  const base=name.replace(/\.[^.]+$/,"").toUpperCase();
  const hit=STORES.find(s=>new RegExp("(^|[^A-Z])"+s+"([^A-Z]|$)").test(base))||STORES.find(s=>base.includes(s));if(hit)return hit;
  for(const r of rows.slice(0,20))for(const c of r){const v=String(c).toUpperCase();const m=STORES.find(s=>new RegExp("\\b"+s+"\\b").test(v));if(m)return m}
  return null}
function readExcelFile(file){
  return new Promise((res,rej)=>{const fr=new FileReader();fr.onerror=()=>rej(new Error("Gagal membaca file "+file.name));
    fr.onload=e=>{try{
      const wb=XLSX.read(new Uint8Array(e.target.result),{type:"array",cellDates:true});
      let best=null;wb.SheetNames.forEach(n=>{const a=XLSX.utils.sheet_to_json(wb.Sheets[n],{header:1,defval:"",raw:true});if(!best||a.length>best.a.length)best={n,a}});
      if(!best||!best.a.length)throw new Error("File kosong: "+file.name);
      const a=best.a;let hi=0,mx=-1;a.slice(0,10).forEach((r,i)=>{const c=r.filter(x=>String(x).trim()!=="").length;if(c>mx){mx=c;hi=i}});
      const seen={};const headers=a[hi].map((h,i)=>{let s=String(h).trim()||"Kolom "+(i+1);if(seen[s]){seen[s]++;s+=" ("+seen[s]+")"}else seen[s]=1;return s});
      const rows=a.slice(hi+1).filter(r=>r.some(x=>String(x).trim()!=="")).map(r=>{const o={};headers.forEach((h,i)=>o[h]=r[i]===undefined?"":r[i]);return o});
      res({file:file.name,store:detectStore(file.name,a),sheet:best.n,headers,rows})
    }catch(err){rej(err)}};fr.readAsArrayBuffer(file)})}
async function handleExcelFiles(files){
  files=[...files];
  const ok=files.filter(f=>/\.(xlsx|xls|csv)$/i.test(f.name));
  if(ok.length<files.length)toast("Format file tidak didukung.",1);
  if(state.excelFiles.length+ok.length>9){toast("File maksimal 9 toko.",1);return}
  const bar=$("#bar");let i=0;
  for(const f of ok){
    try{const d=await readExcelFile(f);state.excelFiles.push({name:f.name,ok:true,store:d.store});state.excelData.push(d)}
    catch(e){state.excelFiles.push({name:f.name,ok:false,err:e.message});toast(e.message||"Gagal membaca "+f.name,1)}
    bar.style.width=(++i/ok.length*100)+"%"}
  setTimeout(()=>bar.style.width="0",600);
  mergeExcelData(state.excelData);renderFiles();renderExcelPreview(state.mergedData)}
function mergeExcelData(data){
  const cols=[];state.mergedData=[];
  data.forEach(d=>{d.headers.forEach(h=>{if(!cols.includes(h))cols.push(h)});d.rows.forEach(r=>state.mergedData.push(Object.assign({STORE:d.store||d.file.replace(/\.[^.]+$/,"")},r)))});
  state.mergedData.cols=["STORE",...cols]}
function renderFiles(){
  $("#fileList").innerHTML=state.excelFiles.map(f=>f.ok?`<li>✓ ${f.name}${f.store?"":" (toko tidak dikenali)"}</li>`:`<li class="bad">✕ ${f.name}</li>`).join("");
  const loaded=new Set(state.excelData.map(d=>d.store).filter(Boolean)).size,n=state.excelData.length;
  if(!state.excelFiles.length)return setStatus($("#xStatus"),"");
  setStatus($("#xStatus"),loaded===9?"✓ Semua toko lengkap":`⚠ ${loaded} dari 9 toko berhasil dimuat (${n} file, ${state.mergedData.length} baris)`,loaded===9?"ok":"warn")}
function renderExcelPreview(data){
  const cols=data.cols||[];const sel=$("#fStore");const cur=view.store;
  sel.innerHTML='<option value="">Semua toko</option>'+[...new Set(data.map(r=>r.STORE))].map(s=>`<option ${s===cur?"selected":""}>${s}</option>`).join("");
  let rows=data.filter(r=>(!view.store||r.STORE===view.store)&&(!view.q||cols.some(c=>String(r[c]).toLowerCase().includes(view.q))));
  if(view.sort)rows=[...rows].sort((a,b)=>{const x=a[view.sort],y=b[view.sort];const c=(typeof x==="number"&&typeof y==="number")?x-y:String(x).localeCompare(String(y),"id",{numeric:true});return view.asc?c:-c});
  const pages=Math.max(1,Math.ceil(rows.length/view.size));view.page=Math.min(view.page,pages-1);
  const show=v=>v instanceof Date?v.toISOString().slice(0,10):(v==null||v===""||(typeof v==="number"&&!isFinite(v)))?"-":v;
  $("#prev").innerHTML=cols.length?"<thead><tr>"+cols.map(c=>`<th data-sort="${c}">${c}${view.sort===c?(view.asc?" ▲":" ▼"):""}</th>`).join("")+"</tr></thead><tbody>"+rows.slice(view.page*view.size,(view.page+1)*view.size).map(r=>"<tr>"+cols.map(c=>`<td>${show(r[c])}</td>`).join("")+"</tr>").join("")+"</tbody>":"<tbody><tr><td>Belum ada data Excel.</td></tr></tbody>";
  $("#count").textContent=`${state.excelData.length} file berhasil dimuat · Jumlah total baris: ${rows.length}`;
  $("#pInfo").textContent=`Hal ${view.page+1} / ${pages}`}
function downloadMasterExcel(){
  if(!state.mergedData.length){toast("Belum ada data Excel.",1);return}
  try{const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(state.mergedData,{header:state.mergedData.cols}),"MASTER");
    const vc=(state.mergedData.cols||[]).find(c=>/total|value|omset|amount|nilai/i.test(c));
    const sum=[...new Set(state.mergedData.map(r=>r.STORE))].map(s=>{const r=state.mergedData.filter(x=>x.STORE===s);const o={STORE:s,"TOTAL ROW":r.length};
      if(vc)o["TOTAL VALUE ("+vc+")"]=r.reduce((a,x)=>a+(parseNumber(x[vc])||0),0);return o});
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(sum),"SUMMARY");
    state.excelData.forEach(d=>{const nm=(d.store||d.file.replace(/\.[^.]+$/,"")).slice(0,31).replace(/[\\\/?*\[\]:]/g,"");if(!wb.SheetNames.includes(nm))XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(d.rows,{header:d.headers}),nm)});
    XLSX.writeFile(wb,`Master_Region_6_${$("#date").value||new Date().toISOString().slice(0,10)}.xlsx`);toast("Master Excel berhasil dibuat")
  }catch(e){toast("Gagal membuat Excel: "+e.message,1)}}
async function downloadPNG(){
  try{toast("Membuat gambar...");const el=$("#capture");
    const c=await html2canvas(el,{scale:2,backgroundColor:"#ffffff",useCORS:true,ignoreElements:n=>n.hasAttribute&&n.hasAttribute("data-nocap")});
    const a=document.createElement("a");a.download=`Report_Region6_${$("#date").value}_${($("#time").value||"").replace(":","")}.png`;a.href=c.toDataURL("image/png");a.click();
  }catch(e){toast("Gagal membuat PNG: "+e.message,1)}}

/* ===== INIT ===== */
function init(){
  $("#wa").innerHTML=STORES.map(s=>`<label>${s}<textarea id="ta-${s}" placeholder="Paste laporan WhatsApp toko ${s} di sini..."></textarea></label>`).join("");
  if(!load())setNow();readInputs();
  if(localStorage.getItem("r6theme")==="dark")document.documentElement.dataset.theme="dark";
  renderTable(state.stores);renderWhatsAppOutput(state.stores);renderExcelPreview([]);
  $("#btnCalc").onclick=handleCalc;$("#btnCopy").onclick=copyWhatsAppReport;$("#btnPng").onclick=downloadPNG;$("#btnXlsx").onclick=downloadMasterExcel;
  $("#btnReset").onclick=()=>$("#dlg").showModal();$("#dlgNo").onclick=()=>$("#dlg").close();$("#dlgYes").onclick=()=>{$("#dlg").close();resetAll()};
  $("#btnClearX").onclick=()=>{state.excelFiles=[];state.excelData=[];state.mergedData=[];$("#file").value="";renderFiles();renderExcelPreview([])};
  $("#btnTheme").onclick=()=>{const d=document.documentElement;d.dataset.theme=d.dataset.theme==="dark"?"":"dark";localStorage.setItem("r6theme",d.dataset.theme||"light")};
  $("#date").onchange=$("#time").onchange=()=>{readInputs();renderWhatsAppOutput(state.stores);save()};
  $("#wa").addEventListener("input",save);
  $("#editTable").addEventListener("input",e=>{const i=e.target;if(!i.dataset.k)return;const s=i.dataset.s;state.stores[s]=state.stores[s]||{t:null,a:null,ly:null,mt:null,ma:null,mly:null,grRaw:null};
    state.stores[s][i.dataset.k]=i.value.trim()===""?null:parseNumber(i.value);refreshComputed()});
  const drop=$("#drop");drop.onclick=()=>$("#file").click();
  $("#file").onchange=e=>{handleExcelFiles(e.target.files);e.target.value=""};
  ["dragover","dragenter"].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add("over")}));
  ["dragleave","drop"].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove("over")}));
  drop.addEventListener("drop",e=>handleExcelFiles(e.dataTransfer.files));
  $("#q").oninput=e=>{view.q=e.target.value.toLowerCase();view.page=0;renderExcelPreview(state.mergedData)};
  $("#fStore").onchange=e=>{view.store=e.target.value;view.page=0;renderExcelPreview(state.mergedData)};
  $("#prev").addEventListener("click",e=>{const c=e.target.dataset.sort;if(!c)return;view.asc=view.sort===c?!view.asc:true;view.sort=c;renderExcelPreview(state.mergedData)});
  $("#pPrev").onclick=()=>{view.page=Math.max(0,view.page-1);renderExcelPreview(state.mergedData)};
  $("#pNext").onclick=()=>{view.page++;renderExcelPreview(state.mergedData)};
  document.addEventListener("keydown",e=>{if(e.ctrlKey&&e.key==="Enter"){e.preventDefault();handleCalc()}
    if(e.ctrlKey&&e.shiftKey&&e.key.toLowerCase()==="c"){e.preventDefault();copyWhatsAppReport()}});
}
document.addEventListener("DOMContentLoaded",init);
