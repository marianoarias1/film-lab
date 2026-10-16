const svg=path=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
export function sheetSizes(height,footer=114,header=58){
 const available=Math.max(120,height-header-footer),max=Math.max(64,available-96);
 return {collapsed:Math.min(52,max),compact:Math.round(Math.min(max,clamp(available*.5,220,360))),expanded:Math.round(Math.min(max,clamp(available*.63,290,460)))};
}
// Grow into the available space below compact; above compact, controls overlay the photo.
export function photoStageHeight(height,footer,sizes,sheetHeight){
 const available=Math.max(96,height-58-footer),minimum=Math.min(available,Math.max(96,available-sizes.compact+92));
 const full=Math.max(minimum,available-sizes.collapsed+12);
 const progress=clamp((sheetHeight-sizes.collapsed)/Math.max(1,sizes.compact-sizes.collapsed),0,1);
 return full+(minimum-full)*progress;
}
export function closestSheetSnap(height,sizes){return Object.keys(sizes).reduce((best,key)=>Math.abs(sizes[key]-height)<Math.abs(sizes[best]-height)?key:best,'compact');}
const icons={
 light:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
 color:'<path d="M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0Z"/><path d="M12 9v9"/>',
 texture:'<circle cx="10" cy="12" r="7"/><circle cx="14" cy="12" r="7"/><path d="m8 6 8 12m-5-14 8 12M5 9l8 12"/>',
 effects:'<rect x="4" y="4" width="16" height="16" rx="1"/><circle cx="12" cy="12" r="6"/>',
 curve:'<path d="M4 20C12 20 12 4 20 4"/><circle cx="4" cy="20" r="1.5"/><circle cx="20" cy="4" r="1.5"/>'
};
export function mountMobileSheet({getState,groupDetails,hslDetail,curveDetail}){
 const $=id=>document.getElementById(id),workspace=document.querySelector('.workspace'),edit=$('editControlsPanel'),frame=$('imageFrame');
 const groupKeys=['light','color','texture','effects'];
 groupDetails.forEach((detail,i)=>detail.dataset.sheetGroup=groupKeys[i]);hslDetail.dataset.sheetGroup='color';hslDetail.dataset.sheetSubgroup='true';curveDetail.dataset.sheetGroup='curve';
 const intensity=document.querySelector('#editingControls .intensity');intensity.dataset.sheetGroup='effects';
 const details=[...groupDetails,curveDetail],openStates=new Map();
 const tabs=document.createElement('div');tabs.className='sheet-group-tabs';tabs.id='mobileAdjustmentGroups';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Grupos de ajustes');
 const labels={light:'Luz',color:'Color',texture:'Textura',effects:'Efectos',curve:'Curva'};
 tabs.innerHTML=Object.entries(labels).map(([key,label])=>`<button type="button" id="sheetGroup-${key}" data-sheet-tab="${key}" role="tab" aria-selected="${key==='light'}" aria-controls="controls"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[key]}</svg><span>${label}</span></button>`).join('');
 $('editingControls').prepend(tabs);let selected='light';
 function selectGroup(key){if(!labels[key])return;selected=key;edit.dataset.sheetGroup=key;for(const el of [...groupDetails,hslDetail,curveDetail,intensity])el.classList.toggle('sheet-group-visible',el.dataset.sheetGroup===key);for(const button of tabs.querySelectorAll('button')){const on=button.dataset.sheetTab===key;button.setAttribute('aria-selected',String(on));button.tabIndex=on?0:-1;}if(mobile){$('adjustmentsPanel').scrollTop=0;for(const d of details)d.open=true;}if(snap==='collapsed')setSnap('compact');}
 for(const button of tabs.querySelectorAll('button')){button.onclick=()=>selectGroup(button.dataset.sheetTab);button.onkeydown=e=>{const keys=Object.keys(labels),index=keys.indexOf(selected),next=e.key==='ArrowRight'?keys[(index+1)%keys.length]:e.key==='ArrowLeft'?keys[(index+keys.length-1)%keys.length]:e.key==='Home'?keys[0]:e.key==='End'?keys.at(-1):null;if(next){e.preventDefault();selectGroup(next);$('sheetGroup-'+next).focus();}};}
 const filterTitle=$('recipesPanel').querySelector('.panel-heading h1'),originalFilterTitle=filterTitle.textContent;
 const exportButton=$('exportButton');exportButton.innerHTML='<span class=desktop-export-label>'+exportButton.innerHTML+'</span>'+svg('<path d="M9 8H5v12h14V8h-4M12 14V3m-4 4 4-4 4 4"/>');exportButton.setAttribute('aria-label','Exportar archivos seleccionados');
 const heading=edit.querySelector('.adjustments-heading'),headingTitle=heading.querySelector('h2'),originalTitle=headingTitle.textContent;
 const crop=document.createElement('button');crop.id='sheetCrop';crop.type='button';crop.className='text-button sheet-crop-action';crop.textContent='⌗ Recortar';crop.setAttribute('aria-label','Recortar, girar y enderezar');crop.onclick=()=>$('framingButton').click();heading.insertBefore(crop,$('resetButton'));
 const handle=document.createElement('div');handle.id='mobileSheetHandle';handle.hidden=true;
 handle.innerHTML=`<button type="button" id="sheetGrip" aria-label="Ampliar panel de controles" aria-controls="adjustmentsPanel recipesPanel"><span class="sheet-handle-line" aria-hidden="true">${svg('<path d="m8 8 4-4 4 4m-8 8 4 4 4-4M12 4v16"/>')}</span><span id="sheetSizeLabel"></span></button><button type="button" id="sheetFinishBrush" hidden>Terminar pincel</button><button type="button" id="sheetCollapse" aria-label="Ocultar controles y ver la foto" aria-controls="adjustmentsPanel recipesPanel">${svg('<path d="m6 9 6 6 6-6"/>')}</button>`;
 workspace.prepend(handle);
 const peek=document.createElement('button');peek.id='sheetPeek';peek.type='button';peek.textContent='Ver foto';peek.className='sheet-photo-action';peek.onclick=()=>setSnap(snap==='collapsed'?'compact':'collapsed');$('dropZone').append(peek);
 const count=document.createElement('span');count.id='sheetFileCount';count.className='sheet-file-count';$('dropZone').append(count);
 const styles=document.createElement('details');styles.id='sheetLabStyles';styles.innerHTML='<summary>Estilos del Laboratorio</summary>';
 const stylesButton=document.createElement('button');stylesButton.id='sheetLabStylesButton';stylesButton.type='button';stylesButton.className='text-button sheet-styles-action';stylesButton.textContent='Estilos';$('labReset').before(stylesButton);stylesButton.onclick=()=>{styles.open=!styles.open;if(styles.open)styles.scrollIntoView?.({block:'nearest'});};
 styles.addEventListener('click',e=>{if(mobile&&e.target.closest('[data-lab-preset]')){styles.open=false;$('adjustmentsPanel').scrollTop=0;}});
 const labSymbols={Film:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 3v18m8-18v18M4 8h4m-4 8h4m8-8h4m-4 8h4"/>',Grade:'<circle cx="12" cy="6" r="4"/><circle cx="7" cy="15" r="4"/><circle cx="17" cy="15" r="4"/>',Dust:'<path d="m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7Z"/>'};
 for(const key of ['Film','Grade','Dust']){const tab=$('lab'+key+'Tab'),label=tab.textContent;tab.innerHTML=`<svg class="sheet-lab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true">${labSymbols[key]}</svg><span>${label}</span>`;}
 const moveTargets=[$('labPresets'),$('labStyleDescription'),$('labSharedGrain')],markers=new Map();
 for(const element of moveTargets){const marker=document.createComment('mobile-sheet-return');element.before(marker);markers.set(element,marker);}
 let mobile=false,active=false,snap='compact',sizes=sheetSizes(window.innerHeight||844),drag=null,suppressClick=false,lastPanel=null,painting=false,preBrushSnap='compact';
 const panelSnaps={};let viewportHeight=window.innerHeight||844,footerHeight=60;
 function setSheetHeight(value){document.documentElement.style.setProperty('--mobile-sheet-height',value+'px');document.documentElement.style.setProperty('--mobile-photo-height',photoStageHeight(viewportHeight,footerHeight,sizes,value)+'px');}
 function setSnap(next){if(!sizes[next])return;snap=next;panelSnaps[getState().mobilePanel]=snap;document.body.dataset.sheetSnap=snap;setSheetHeight(sizes[snap]);$('sheetSizeLabel').textContent=snap==='collapsed'?'Mostrar controles':'';$('sheetGrip').setAttribute('aria-label',snap==='collapsed'?'Mostrar controles':snap==='compact'?'Ampliar panel de controles':'Reducir panel de controles');$('sheetGrip').setAttribute('aria-expanded',String(snap!=='collapsed'));$('sheetCollapse').setAttribute('aria-label',snap==='collapsed'?'Mostrar controles':'Ocultar controles y ver la foto');$('sheetCollapse').firstElementChild.style.transform=snap==='collapsed'?'rotate(180deg)':'';peek.textContent=snap==='collapsed'?'Mostrar controles':'Ver foto';}
 $('sheetGrip').onclick=()=>{if(suppressClick){suppressClick=false;return;}setSnap(snap==='compact'?'expanded':'compact');};
 $('sheetCollapse').onclick=()=>setSnap(snap==='collapsed'?'compact':'collapsed');
 $('sheetFinishBrush').onclick=()=>$('labRegionBrush').click();
 const grip=$('sheetGrip');
 grip.onkeydown=e=>{const order=['collapsed','compact','expanded'],i=order.indexOf(snap);const next=e.key==='ArrowUp'?order[Math.min(2,i+1)]:e.key==='ArrowDown'?order[Math.max(0,i-1)]:e.key==='Home'?'collapsed':e.key==='End'?'expanded':null;if(next){e.preventDefault();setSnap(next);}};
 grip.addEventListener('pointerdown',e=>{if(e.button>0||!active)return;drag={id:e.pointerId,y:e.clientY,height:sizes[snap],moved:false};grip.setPointerCapture?.(e.pointerId);});
 grip.addEventListener('pointermove',e=>{if(!drag||drag.id!==e.pointerId)return;const distance=drag.y-e.clientY;if(Math.abs(distance)>5){drag.moved=true;document.body.classList.add('sheet-dragging');}if(drag.moved){e.preventDefault();setSheetHeight(clamp(drag.height+distance,sizes.collapsed,sizes.expanded));}});
 function endDrag(e){if(!drag||e.pointerId!==drag.id)return;if(drag.moved){suppressClick=true;setSnap(closestSheetSnap(clamp(drag.height+drag.y-e.clientY,sizes.collapsed,sizes.expanded),sizes));setTimeout(()=>suppressClick=false,0);}drag=null;document.body.classList.remove('sheet-dragging');}
 grip.addEventListener('pointerup',endDrag);grip.addEventListener('pointercancel',e=>{if(drag){drag=null;document.body.classList.remove('sheet-dragging');setSnap(snap);}});grip.addEventListener('lostpointercapture',()=>{if(drag){drag=null;document.body.classList.remove('sheet-dragging');setSnap(snap);}});window.addEventListener('blur',()=>{if(drag){drag=null;document.body.classList.remove('sheet-dragging');setSnap(snap);}});
 function enterMobile(){for(const d of [...details,hslDetail]){openStates.set(d,d.open);if(d!==hslDetail)d.open=true;}headingTitle.textContent='Editar';filterTitle.textContent='Filtros';$('labPresets').before(styles);styles.append($('labPresets'),$('labStyleDescription'));$('labFilmPanel').append($('labSharedGrain'));selectGroup(selected);}
 function leaveMobile(){for(const [element,marker]of markers)marker.after(element);styles.remove();for(const [d,open]of openStates)d.open=open;openStates.clear();headingTitle.textContent=originalTitle;filterTitle.textContent=originalFilterTitle;document.body.classList.remove('sheet-dragging');drag=null;}
 function sync(){const state=getState(),nextMobile=window.innerWidth<=850;if(nextMobile!==mobile){mobile=nextMobile;if(mobile)enterMobile();else leaveMobile();}
   active=mobile&&['adjustments','laboratory','recipes'].includes(state.mobilePanel)&&!!state.photos.find(p=>p.id===state.activeId);document.body.classList.toggle('mobile-sheet-active',active);handle.hidden=!active;crop.disabled=$('framingButton').disabled;
   if(!active){if(!mobile)document.documentElement.style.removeProperty('--mobile-sheet-height');return;}
   const footer=(document.querySelector('.mobile-tabs').getBoundingClientRect().height||60),height=window.visualViewport?.height||window.innerHeight||844; sizes=sheetSizes(height,footer);viewportHeight=height;footerHeight=footer;
   if(lastPanel!==state.mobilePanel){snap=panelSnaps[state.mobilePanel]||'compact';lastPanel=state.mobilePanel;}
   if(!drag)setSnap(snap);
   const index=state.photos.findIndex(p=>p.id===state.activeId);count.textContent=(index+1)+' de '+state.photos.length;
   document.body.classList.toggle('sheet-has-video',!!state.videoMedia);
   const nextPainting=frame.classList.contains('region-painting');if(nextPainting!==painting){painting=nextPainting;if(painting){preBrushSnap=snap;setSnap('collapsed');}else{panelSnaps.laboratory=preBrushSnap;if(state.mobilePanel==='laboratory')setSnap(preBrushSnap);}}
   $('sheetFinishBrush').hidden=!painting;peek.hidden=painting;
 }
 new MutationObserver(()=>{const next=frame.classList.contains('region-painting');if(next!==painting)sync();}).observe(frame,{attributes:true,attributeFilter:['class']});
 new MutationObserver(()=>{crop.disabled=$('framingButton').disabled;}).observe($('framingButton'),{attributes:true,attributeFilter:['disabled']});
 window.addEventListener('resize',sync);window.visualViewport?.addEventListener('resize',sync);window.addEventListener('orientationchange',sync);
 sync();return {sync,selectGroup,setSnap};
}
