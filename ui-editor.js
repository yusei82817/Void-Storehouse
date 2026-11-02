const STAGE_W = 1920;
const STAGE_H = 1080;
const stage = document.querySelector('#canvas-stage');
const stageWrap = document.querySelector('#canvas-stage-wrap');
const $ = (s) => document.querySelector(s);
const status = (message) => { $('#status-message').textContent = message; };
const elements = [];
let selected = null;
let nextId = 1;
let scale = 1;
let previewMode = false;
let history = [];
let historyIndex = -1;
let restoring = false;

const defaults = {
  text: {name:'Text', content:'テキスト', x:160, y:140, w:600, h:110, color:'#ffffff', bg:'#263b4a', fontSize:64, radius:0, align:'left'},
  button: {name:'Button', content:'BUTTON', x:760, y:760, w:400, h:110, color:'#ffffff', bg:'#398db5', fontSize:42, radius:18, align:'center'},
  panel: {name:'Panel', content:'', x:120, y:120, w:700, h:420, color:'#ffffff', bg:'#ffffff', fontSize:32, radius:24, align:'left'},
  image: {name:'Image', content:'', x:600, y:250, w:520, h:360, color:'#ffffff', bg:'#dce9ee', fontSize:32, radius:12, align:'center', image:''},
  input: {name:'Input', content:'入力してください...', x:650, y:760, w:620, h:90, color:'#78909c', bg:'#ffffff', fontSize:30, radius:12, align:'left'}
};

function clone(value){ return JSON.parse(JSON.stringify(value)); }
function snapshot(){
  return {documentName:$('#document-name').value, elements:elements.map(e=>({...e}))};
}
function pushHistory(){
  if(restoring) return;
  const state = snapshot();
  const previous = history[historyIndex];
  if(previous && JSON.stringify(previous) === JSON.stringify(state)) return;
  history = history.slice(0, historyIndex + 1);
  history.push(state);
  if(history.length > 60) history.shift();
  historyIndex = history.length - 1;
  updateHistoryButtons();
}
function restoreState(state){
  restoring = true;
  elements.splice(0, elements.length, ...state.elements.map(e=>({...e})));
  $('#document-name').value = state.documentName || 'Untitled UI';
  nextId = elements.reduce((max,e)=>Math.max(max,Number(String(e.id).split('_').pop())+1||1),1);
  selected = null;
  renderAll();
  setSelection(null);
  restoring = false;
}
function updateHistoryButtons(){
  $('#undo-button').disabled = historyIndex <= 0;
  $('#redo-button').disabled = historyIndex >= history.length - 1;
}
function undo(){ if(historyIndex>0){historyIndex--;restoreState(history[historyIndex]);status('ひとつ前の状態に戻したよ。');updateHistoryButtons();} }
function redo(){ if(historyIndex<history.length-1){historyIndex++;restoreState(history[historyIndex]);status('操作をやり直したよ。');updateHistoryButtons();} }

function fitStage(){
  const availableW = Math.max(100, stageWrap.clientWidth - 36);
  const availableH = Math.max(100, stageWrap.clientHeight - 36);
  scale = Math.min(availableW/STAGE_W, availableH/STAGE_H);
  stage.style.transform = 'scale('+scale+')';
  $('#zoom-label').textContent = Math.round(scale*100)+'%';
}
new ResizeObserver(fitStage).observe(stageWrap);
window.addEventListener('resize', fitStage);

function makeId(){ return 'ui_'+nextId++; }
function addElement(type, data={}){
  const base = defaults[type];
  if(!base) return;
  const item = {id:data.id||makeId(),type,...clone(base),...data};
  item.x = Number(item.x)||0; item.y=Number(item.y)||0;
  item.w=Math.max(1,Number(item.w)||100); item.h=Math.max(1,Number(item.h)||50);
  elements.push(item);
  renderAll();
  setSelection(item.id);
  pushHistory();
  status(item.name+' を追加したよ。');
}
function createNode(item){
  const node=document.createElement('div');
  node.className='ui-element type-'+item.type;
  node.dataset.id=item.id;
  node.style.left=item.x+'px';node.style.top=item.y+'px';
  node.style.width=item.w+'px';node.style.height=item.h+'px';
  node.style.color=item.color;node.style.background=item.type==='text'?'transparent':item.bg;
  node.style.fontSize=item.fontSize+'px';node.style.borderRadius=item.radius+'px';
  node.style.textAlign=item.align;
  if(item.type==='text'){
    node.textContent=item.content;
    node.style.alignItems='center';
    node.style.justifyContent=item.align==='center'?'center':item.align==='right'?'flex-end':'flex-start';
  }else if(item.type==='button'){
    node.textContent=item.content;
    node.style.justifyContent='center';
    node.style.fontWeight='700';
  }else if(item.type==='panel'){
    node.style.background=item.bg;
    node.style.border='1px solid #ffffff35';
  }else if(item.type==='image'){
    if(item.image){
      const img=document.createElement('img');img.src=item.image;img.alt=item.name;img.draggable=false;
      img.onerror=()=>{node.textContent='画像を読み込めません';};
      node.append(img);
    }else{
      node.textContent='IMAGE';
      node.style.justifyContent='center';
      node.style.color='#7894a2';
    }
  }else if(item.type==='input'){
    node.textContent=item.content||'入力してください...';
    node.style.padding='0 24px';
    node.style.alignItems='center';
    node.style.border='2px solid #b8cbd5';
  }
  if(item.id===selected?.id) node.classList.add('selected');
  const handle=document.createElement('span');handle.className='resize-handle';handle.setAttribute('aria-hidden','true');node.append(handle);
  node.addEventListener('pointerdown',onElementPointerDown);
  return node;
}
function renderCanvas(){
  stage.replaceChildren();
  elements.forEach(item=>stage.append(createNode(item)));
  stage.classList.toggle('preview-mode',previewMode);
}
function renderLayers(){
  const list=$('#layer-list');list.replaceChildren();
  if(!elements.length){const p=document.createElement('p');p.className='empty-list';p.textContent='まだパーツがないよ。';list.append(p);}
  [...elements].reverse().forEach(item=>{
    const button=document.createElement('button');button.type='button';
    button.className='layer-item'+(item.id===selected?.id?' active':'');
    const symbol=document.createElement('span');symbol.className='layer-symbol';symbol.textContent=({text:'T',button:'B',panel:'P',image:'▧',input:'I'})[item.type];
    const name=document.createElement('span');name.className='layer-name';name.textContent=item.name;
    const type=document.createElement('small');type.className='layer-type';type.textContent=item.type.toUpperCase();
    button.append(symbol,name,type);button.addEventListener('click',()=>setSelection(item.id));list.append(button);
  });
  const active=!!selected;
  ['up-button','down-button','duplicate-button','delete-button'].forEach(id=>$('#'+id).disabled=!active);
}
function renderAll(){renderCanvas();renderLayers();syncInspector();fitStage();}

function setSelection(id){
  selected=id?elements.find(e=>e.id===id)||null:null;
  stage.querySelectorAll('.ui-element').forEach(n=>n.classList.toggle('selected',n.dataset.id===selected?.id));
  $('#inspector-empty').hidden=!!selected;
  $('#inspector').hidden=!selected;
  $('#selection-label').textContent=selected?selected.name:'未選択';
  renderLayers();
  syncInspector();
}
function syncInspector(){
  if(!selected)return;
  $('#prop-name').value=selected.name;
  $('#prop-content').value=selected.content||'';
  $('#prop-x').value=Math.round(selected.x);
  $('#prop-y').value=Math.round(selected.y);
  $('#prop-w').value=Math.round(selected.w);
  $('#prop-h').value=Math.round(selected.h);
  $('#prop-color').value=validColor(selected.color)?selected.color:'#ffffff';
  $('#prop-bg').value=validColor(selected.bg)?selected.bg:'#ffffff';
  $('#prop-color-value').textContent=selected.color;
  $('#prop-bg-value').textContent=selected.bg;
  $('#prop-font').value=selected.fontSize;
  $('#prop-radius').value=selected.radius;
  $('#prop-align').value=selected.align||'left';
  $('#prop-image').value=selected.image||'';
  $('#prop-content').disabled=selected.type==='panel'||selected.type==='image';
  $('#prop-image').disabled=selected.type!=='image';
}
function validColor(value){return /^#[0-9a-f]{6}$/i.test(value||'');}
function updateSelected(key,value){
  if(!selected)return;
  selected[key]=value;
  renderCanvas();renderLayers();
  $('#selection-label').textContent=selected.name;
  pushHistory();
}
function bindText(id,key,convert=v=>v){
  $(id).addEventListener('change',()=>{if(!selected)return;updateSelected(key,convert($(id).value));syncInspector();});
}
bindText('#prop-name','name',v=>v.trim()||'Unnamed');
bindText('#prop-content','content');
for(const [id,key] of [['#prop-x','x'],['#prop-y','y'],['#prop-w','w'],['#prop-h','h'],['#prop-font','fontSize'],['#prop-radius','radius']]){
  bindText(id,key,v=>Number(v));
}
bindText('#prop-color','color');
bindText('#prop-bg','bg');
bindText('#prop-align','align');
bindText('#prop-image','image');

function pointerToCanvas(event){
  const rect=stage.getBoundingClientRect();
  return {x:(event.clientX-rect.left)/rect.width*STAGE_W,y:(event.clientY-rect.top)/rect.height*STAGE_H};
}
let pointerAction=null;
function onElementPointerDown(event){
  if(previewMode)return;
  const node=event.currentTarget;
  const item=elements.find(e=>e.id===node.dataset.id);
  if(!item)return;
  event.stopPropagation();
  setSelection(item.id);
  const isResize=event.target.classList.contains('resize-handle');
  const point=pointerToCanvas(event);
  pointerAction={id:item.id,kind:isResize?'resize':'move',startX:point.x,startY:point.y,x:item.x,y:item.y,w:item.w,h:item.h,changed:false};
  node.setPointerCapture?.(event.pointerId);
  window.addEventListener('pointermove',onPointerMove);
  window.addEventListener('pointerup',onPointerUp,{once:true});
}
function onPointerMove(event){
  if(!pointerAction)return;
  const item=elements.find(e=>e.id===pointerAction.id);if(!item)return;
  const point=pointerToCanvas(event);
  const dx=point.x-pointerAction.startX,dy=point.y-pointerAction.startY;
  if(pointerAction.kind==='move'){
    item.x=Math.round(Math.max(0,Math.min(STAGE_W-item.w,pointerAction.x+dx)));
    item.y=Math.round(Math.max(0,Math.min(STAGE_H-item.h,pointerAction.y+dy)));
  }else{
    item.w=Math.round(Math.max(20,Math.min(STAGE_W-item.x,pointerAction.w+dx)));
    item.h=Math.round(Math.max(20,Math.min(STAGE_H-item.y,pointerAction.h+dy)));
  }
  pointerAction.changed=true;
  const node=stage.querySelector('[data-id="'+item.id+'"]');
  if(node){node.style.left=item.x+'px';node.style.top=item.y+'px';node.style.width=item.w+'px';node.style.height=item.h+'px';}
  $('#selection-label').textContent=item.name+'  '+item.x+', '+item.y;
}
function onPointerUp(){
  window.removeEventListener('pointermove',onPointerMove);
  if(pointerAction?.changed){syncInspector();pushHistory();}
  pointerAction=null;
}
stage.addEventListener('pointerdown',event=>{if(event.target===stage&&!previewMode)setSelection(null);});
window.addEventListener('keydown',event=>{
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();event.shiftKey?redo():undo();}
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='y'){event.preventDefault();redo();}
  if(event.key==='Delete'&&selected&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)&&!previewMode)deleteSelected();
});

function duplicateSelected(){
  if(!selected)return;
  const copy={...selected,id:makeId(),name:selected.name+' Copy',x:Math.min(STAGE_W-selected.w,selected.x+36),y:Math.min(STAGE_H-selected.h,selected.y+36)};
  elements.push(copy);renderAll();setSelection(copy.id);pushHistory();status('パーツを複製したよ。');
}
function deleteSelected(){
  if(!selected)return;
  const name=selected.name;const index=elements.findIndex(e=>e.id===selected.id);
  if(index>=0)elements.splice(index,1);
  selected=null;renderAll();setSelection(null);pushHistory();status(name+' を削除したよ。');
}
function moveLayer(direction){
  if(!selected)return;
  const i=elements.findIndex(e=>e.id===selected.id),j=i+direction;
  if(j<0||j>=elements.length)return;
  [elements[i],elements[j]]=[elements[j],elements[i]];
  renderAll();setSelection(selected.id);pushHistory();
}
$('#duplicate-button').addEventListener('click',duplicateSelected);
$('#delete-button').addEventListener('click',deleteSelected);
$('#up-button').addEventListener('click',()=>moveLayer(1));
$('#down-button').addEventListener('click',()=>moveLayer(-1));
$('#clear-selection').addEventListener('click',()=>setSelection(null));
$('#undo-button').addEventListener('click',undo);
$('#redo-button').addEventListener('click',redo);

document.querySelectorAll('[data-add]').forEach(button=>button.addEventListener('click',()=>addElement(button.dataset.add)));
$('#document-name').addEventListener('change',pushHistory);
$('#preview-button').addEventListener('click',()=>{
  previewMode=!previewMode;
  stage.classList.toggle('preview-mode',previewMode);
  $('#preview-button').textContent=previewMode?'EDIT':'PREVIEW';
  if(previewMode)setSelection(null);
  status(previewMode?'プレビュー中。配置を確認してね。':'編集モードに戻ったよ。');
});

function saveUI(){
  const data={format:'VOID_STOREHOUSE_UI',version:1,uiName:$('#document-name').value.trim()||'Untitled UI',createdAt:new Date().toISOString(),editor:'VOID STOREHOUSE UI EDITOR',canvas:{width:STAGE_W,height:STAGE_H,aspectRatio:'16:9'},elements:elements.map(e=>({...e}))};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='UI.JSON';document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url);
  status('UI.JSON を保存したよ。パーツ '+elements.length+' 個。');
}
function loadUI(data){
  if(!data||data.format!=='VOID_STOREHOUSE_UI'||!Array.isArray(data.elements)){status('このJSONは対応していない形式だよ。');return;}
  const allowed=['text','button','panel','image','input'];
  const incoming=data.elements.filter(e=>allowed.includes(e.type)&&typeof e==='object').map(e=>{
    const base=defaults[e.type];
    return {...clone(base),...e,id:String(e.id||makeId()),x:Number(e.x)||0,y:Number(e.y)||0,w:Math.max(1,Number(e.w)||base.w),h:Math.max(1,Number(e.h)||base.h)};
  });
  elements.splice(0,elements.length,...incoming);
  $('#document-name').value=data.uiName||'Untitled UI';
  nextId=elements.reduce((max,e)=>Math.max(max,Number(String(e.id).split('_').pop())+1||1),1);
  selected=null;renderAll();setSelection(null);pushHistory();status('UI.JSON を読み込んだよ。');
}
$('#save-button').addEventListener('click',saveUI);
$('#load-button').addEventListener('click',()=>$('#file-input').click());
$('#file-input').addEventListener('change',async event=>{
  const file=event.target.files?.[0];if(!file)return;
  try{loadUI(JSON.parse(await file.text()));}catch(error){console.error(error);status('JSONを読み込めなかったよ。ファイルを確認してね。');}
  event.target.value='';
});

renderAll();
pushHistory();
status('準備完了。左からパーツを追加してね。');
