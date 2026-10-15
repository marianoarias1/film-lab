// Fit both axes so portrait images do not overflow the desktop preview.
export function fittedPreview(imageWidth,imageHeight,availableWidth,availableHeight,zoom=1){
 if(![imageWidth,imageHeight,availableWidth,availableHeight].every(v=>Number.isFinite(v)&&v>0))return null;
 const scale=Math.min(availableWidth/imageWidth,availableHeight/imageHeight);
 return {width:Math.min(availableWidth,imageWidth*scale)*zoom,height:Math.min(availableHeight,imageHeight*scale)*zoom};
}

export function mountPreviewLayout({getState}){
 const $=id=>document.getElementById(id),album=$('album'),frame=$('imageFrame'),area=$('dropZone'),toolbar=document.querySelector('.stage-toolbar'),stage=$('photoPanel');
 const toggle=document.createElement('button');toggle.id='desktopFiles';toggle.type='button';toggle.className='button outline compact desktop-files';toggle.setAttribute('aria-controls','album');toggle.setAttribute('aria-expanded','false');$('uploadButton').before(toggle);
 const close=document.createElement('button');close.id='closeDesktopFiles';close.type='button';close.className='text-button desktop-files';close.textContent='Cerrar archivos';album.querySelector('.album-heading').append(close);
 let open=false,lastId=null;
 function setOpen(value){open=value;stage.dataset.filesOpen=String(value);toggle.setAttribute('aria-expanded',String(value));}
 toggle.onclick=()=>{setOpen(!open);if(open)album.scrollIntoView?.({block:'nearest',behavior:'smooth'});};
 close.onclick=()=>{setOpen(false);area.scrollIntoView?.({block:'nearest',behavior:'smooth'});};
 album.addEventListener('click',e=>{if(window.innerWidth>850&&e.target.closest('.photo-open'))setOpen(false);});
 function fit(){
  if(window.innerWidth<=850||$('fullscreenDialog').open||area.parentElement!==stage){frame.style.removeProperty('width');frame.style.removeProperty('height');return;}
  const style=window.getComputedStyle(area),width=Math.max(0,area.clientWidth-parseFloat(style.paddingLeft||0)-parseFloat(style.paddingRight||0)),height=Math.max(0,area.clientHeight-parseFloat(style.paddingTop||0)-parseFloat(style.paddingBottom||0));
  const result=fittedPreview($('beforeCanvas').width,$('beforeCanvas').height,width,height,frame.classList.contains('zoomed')?1.75:1);
  if(result){frame.style.width=result.width+'px';frame.style.height=result.height+'px';}
 }
 function sync(){const state=getState(),desktop=window.innerWidth>850;toggle.hidden=!state.photos.length;toggle.textContent=`Archivos · ${state.photos.length}`;
  if(lastId!==state.activeId){lastId=state.activeId;frame.classList.remove('zoomed');$('zoomButton').setAttribute('aria-pressed','false');$('zoomButton').textContent='⊕ Acercar';area.scrollTop=area.scrollLeft=0;}
  if(desktop){if(album.previousElementSibling!==toolbar)toolbar.after(album);}else if(album.previousElementSibling!==stage.querySelector('.stage-top'))stage.querySelector('.stage-top').after(album);
  if(!state.photos.length)setOpen(false);else setOpen(open);fit();
 }
 new MutationObserver(sync).observe($('photoList'),{childList:true});
 new MutationObserver(fit).observe(frame,{attributes:true,attributeFilter:['class']});
 new MutationObserver(fit).observe($('beforeCanvas'),{attributes:true,attributeFilter:['width','height']});
 new MutationObserver(fit).observe($('fullscreenDialog'),{attributes:true,attributeFilter:['open']});
 if(typeof ResizeObserver!=='undefined')new ResizeObserver(fit).observe(area);
 window.addEventListener('resize',sync);sync();return {sync,fit};
}
