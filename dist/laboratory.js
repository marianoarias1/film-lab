import {laboratoryDefaults,normalizeLaboratory,presets} from './laboratory-engine.js';

// Only this module owns laboratory controls; image state stays in the existing editor.
export function mountLaboratory({getState,checkpoint,onChange,showPanel}) {
 const $=id=>document.getElementById(id),aside=$('adjustmentsPanel');
 const edit=document.createElement('div');edit.id='editControlsPanel';
 while(aside.firstChild)edit.append(aside.firstChild);
 const tabs=document.createElement('div');tabs.className='editor-tabs';tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Herramientas de edición');
 tabs.innerHTML='<button type="button" id="desktopEditTab" role="tab" aria-selected="true" aria-controls="editControlsPanel">Editar</button><button type="button" id="desktopLabTab" role="tab" aria-selected="false" aria-controls="laboratoryPanel">Laboratorio</button>';
 const panel=document.createElement('section');panel.id='laboratoryPanel';panel.hidden=true;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','desktopLabTab');edit.setAttribute('role','tabpanel');edit.setAttribute('aria-labelledby','desktopEditTab');
 panel.innerHTML=`<div class="adjustments-heading"><div><span class="eyebrow">EXPERIMENTÁ</span><h2>Laboratorio</h2></div><button type="button" id="labReset" class="text-button">Restablecer</button></div><p class="lab-intro">Un estilo como punto de partida. Cada componente, a tu manera.</p><p id="labUnavailable" class="lab-message" role="status"></p><fieldset id="labControls" class="lab-fieldset"><legend class="sr-only">Efectos de Laboratorio</legend><div class="lab-presets" id="labPresets"></div><p id="labStyleDescription" class="lab-description" role="status"></p><div class="lab-component-tabs" role="tablist" aria-label="Componentes de Laboratorio"><button type="button" id="labFilmTab" role="tab" aria-controls="labFilmPanel" aria-selected="true">Película</button><button type="button" id="labGradeTab" role="tab" aria-controls="labGradePanel" aria-selected="false">Color de cine</button></div><section id="labFilmPanel" role="tabpanel" aria-labelledby="labFilmTab"><label class="lab-enable"><strong>Película envejecida</strong><span><input type="checkbox" id="labFilmEnabled"> Activar</span></label><div id="labFilmControls"></div><p id="labMoveHint" class="lab-description" hidden>Arrastrá el punto sobre la foto para ubicar la fuga.</p><button type="button" id="labNewTexture" class="text-button">↻ Probar otra textura</button></section><section id="labGradePanel" role="tabpanel" aria-labelledby="labGradeTab" hidden><label class="lab-enable"><strong>Color cinematográfico</strong><span><input type="checkbox" id="labGradeEnabled"> Activar</span></label><p class="lab-description">Teñí sombras, tonos medios y luces por separado.</p><div id="labGradeControls"></div></section><p class="lab-description lab-foot">Se suma a tu filtro actual. La intensidad de la receta no modifica estos efectos. Solo fotografías por el momento.</p></fieldset>`;
 aside.append(tabs,edit,panel);aside.dataset.editorTab='adjustments';
 const mobile=document.createElement('button');mobile.type='button';mobile.dataset.panel='laboratory';mobile.setAttribute('role','tab');mobile.setAttribute('aria-selected','false');mobile.textContent='Laboratorio';document.querySelector('[data-panel="project"]').before(mobile);mobile.onclick=()=>showPanel('laboratory');
 const handle=document.createElement('button');handle.type='button';handle.id='labLeakHandle';handle.className='lab-leak-handle';handle.textContent='＋';handle.hidden=true;handle.setAttribute('aria-label','Mover fuga de luz. Arrastrá o usá las flechas del teclado');$('imageFrame').append(handle);
 function selectEditor(tab){aside.dataset.editorTab=tab;edit.hidden=tab==='laboratory';panel.hidden=tab!=='laboratory';$('desktopEditTab').setAttribute('aria-selected',tab==='adjustments');$('desktopLabTab').setAttribute('aria-selected',tab==='laboratory');sync();}
 $('desktopEditTab').onclick=()=>selectEditor('adjustments');$('desktopLabTab').onclick=()=>selectEditor('laboratory');
 for(const id of ['desktopEditTab','desktopLabTab'])$(id).onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const lab=e.key==='End'||e.key!=='Home'&&id==='desktopEditTab';selectEditor(lab?'laboratory':'adjustments');$(lab?'desktopLabTab':'desktopEditTab').focus();};
 function component(which){for(const key of ['Film','Grade']){$('lab'+key+'Panel').hidden=key!==which;$('lab'+key+'Tab').setAttribute('aria-selected',key===which);}sync();}
 for(const key of ['Film','Grade']){$('lab'+key+'Tab').onclick=()=>component(key);$('lab'+key+'Tab').onkeydown=e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();const next=e.key==='Home'?'Film':e.key==='End'?'Grade':key==='Film'?'Grade':'Film';component(next);$('lab'+next+'Tab').focus();}};}
 const filmControls=[['fade','Color deslavado'],['grain','Grano'],['dust','Polvo'],['leak','Fuga de luz'],['leakTemperature','Temperatura de la fuga']];
 function slider(id,label){return `<div class="slider-control lab-control"><div class="control-label"><label for="${id}">${label}</label><output id="${id}Value"></output></div><input id="${id}" type="range" min="0" max="100"></div>`;}
 $('labFilmControls').innerHTML=filmControls.map(([key,label])=>slider('lab-'+key,label)).join('');
 const temperatureCaption=document.createElement('div');temperatureCaption.className='lab-temp-labels';temperatureCaption.innerHTML='<span>Fría</span><span>Cálida</span>';$('lab-leakTemperature').after(temperatureCaption);
 const tones=[['shadows','Sombras','Zonas oscuras','shadowAmount'],['mids','Tonos medios','Tonos intermedios','midAmount'],['highlights','Luces','Zonas luminosas','highlightAmount']];
 const colors=[['#427e93','Azul petróleo'],['#8b76ae','Lavanda'],['#d7ae8a','Arena'],['#efbb79','Dorado'],['#87a17c','Verde suave']];
 $('labGradeControls').innerHTML=tones.map(([key,label,description,amount])=>`<div class="lab-tone"><div class="lab-tone-title"><strong>${label}</strong><label>Color <input id="lab-${key}" type="color" aria-label="Color de ${label.toLowerCase()}"></label></div><small>${description}</small><div class="lab-colors">${colors.map(([color,title])=>`<button type="button" style="background:${color}" data-tone="${key}" data-color="${color}" aria-label="${title} en ${label.toLowerCase()}" title="${title}"></button>`).join('')}</div>${slider('lab-'+amount,'Intensidad')}</div>`).join('');
 $('labPresets').innerHTML=Object.entries(presets).map(([key,p])=>`<button type="button" data-lab-preset="${key}" aria-pressed="false"><span style="background:linear-gradient(140deg,${p.grade.shadows},${p.grade.highlights})" aria-hidden="true"></span>${p.name}</button>`).join('');
 let lastId=null,gesture=null,pointer=null;
 const current=()=>getState().photos.find(p=>p.id===getState().activeId);
 const canEdit=()=>!!current()&&current().kind!=='video'&&!getState().busy;
 const value=()=>normalizeLaboratory(getState().settings.laboratory)||laboratoryDefaults();
 function start(){if(!gesture||gesture!==getState().activeId){checkpoint();gesture=getState().activeId;}}
 function finish(){gesture=null;pointer=null;frame.dataset.labMoving='false';frame.classList.remove('lab-moving');}
 function mutate(fn,continuous=false){if(!canEdit())return;if(!continuous)finish();start();const next=value();fn(next);getState().settings.laboratory=next;onChange();if(!continuous)finish();sync();}
 function bindRange(id,group,key,scale=1){$(id).oninput=e=>{const number=Number(e.target.value)/scale;mutate(s=>{s[group][key]=number;},true);};for(const event of ['change','pointerup','pointercancel','blur'])$(id).addEventListener(event,finish);}
 for(const [key]of filmControls)bindRange('lab-'+key,'film',key);
 for(const [key,,,amount]of tones){bindRange('lab-'+amount,'grade',amount);$('lab-'+key).oninput=e=>{const color=e.target.value;mutate(s=>{s.grade[key]=color;},true);};$('lab-'+key).onchange=finish;$('lab-'+key).onblur=finish;}
 for(const [group,id]of [['film','labFilmEnabled'],['grade','labGradeEnabled']])$(id).onchange=e=>{const checked=e.currentTarget.checked;mutate(s=>{s[group].enabled=checked;});};
 for(const b of panel.querySelectorAll('[data-tone]'))b.onclick=()=>mutate(s=>{s.grade[b.dataset.tone]=b.dataset.color;});
 for(const b of panel.querySelectorAll('[data-lab-preset]'))b.onclick=()=>{const preset=presets[b.dataset.labPreset];mutate(s=>{s.film=structuredClone(preset.film);s.grade=structuredClone(preset.grade);});};
 $('labNewTexture').onclick=()=>mutate(s=>{s.seed=(s.seed+17033)>>>0;});
 $('labReset').onclick=()=>{if(!canEdit())return;finish();checkpoint();getState().settings.laboratory=null;onChange();sync();};

 function visible(){return window.innerWidth<=850?getState().mobilePanel==='laboratory':aside.dataset.editorTab==='laboratory';}
 // Canvas is object-fit:contain on mobile; exclude letterboxing from coordinates.
 function bounds(){const r=$('afterCanvas').getBoundingClientRect(),ratio=$('afterCanvas').width/($('afterCanvas').height||1);const width=Math.min(r.width,r.height*ratio),height=width/ratio;return {left:r.left+(r.width-width)/2,top:r.top+(r.height-height)/2,width,height};}
 function position(){const f=$('imageFrame').getBoundingClientRect(),b=bounds(),s=value().film;if(!f.width||!f.height)return;handle.style.left=((b.left-f.left+s.leakX*b.width)/f.width*100)+'%';handle.style.top=((b.top-f.top+s.leakY*b.height)/f.height*100)+'%';}
 const frame=$('imageFrame');
 frame.addEventListener('pointerdown',e=>{if(e.target!==handle||!visible()||!canEdit()||getState().compare||pointer!==null||e.button>0)return;e.preventDefault();pointer=e.pointerId;frame.setPointerCapture?.(pointer);place(e);});
 function place(e){const b=bounds();if(!b.width||!b.height)return;mutate(s=>{s.film.leakX=Math.max(0,Math.min(1,(e.clientX-b.left)/b.width));s.film.leakY=Math.max(0,Math.min(1,(e.clientY-b.top)/b.height));},true);position();}
 frame.addEventListener('pointermove',e=>{if(pointer===e.pointerId&&canEdit())place(e);});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])frame.addEventListener(event,e=>{if(e.pointerId===pointer)finish();});
 handle.onkeydown=e=>{const d={ArrowLeft:['leakX',-.01],ArrowRight:['leakX',.01],ArrowUp:['leakY',-.01],ArrowDown:['leakY',.01]}[e.key];if(!d)return;e.preventDefault();mutate(s=>{s.film[d[0]]=Math.max(0,Math.min(1,s.film[d[0]]+d[1]));});};
 function sync(){const state=getState(),p=current(),s=value(),available=canEdit();if(lastId!==state.activeId){lastId=state.activeId;finish();}
 $('labControls').disabled=!available;$('labReset').disabled=!available||!state.settings.laboratory;$('labUnavailable').hidden=!!p&&p.kind!=='video';$('labUnavailable').textContent=!p?'Cargá una fotografía para experimentar.':p.kind==='video'?'Laboratorio está disponible para fotografías. Los videos conservan sus ajustes de Editar.':'';
 $('labFilmEnabled').checked=s.film.enabled;$('labGradeEnabled').checked=s.grade.enabled;
 for(const [key]of filmControls){$('lab-'+key).value=s.film[key];$('lab-'+key+'Value').value=key==='leakTemperature'?(s.film[key]<45?'Fría':s.film[key]>55?'Cálida':'Neutra')+' · '+s.film[key]:s.film[key];}
 for(const [key,,,amount]of tones){$('lab-'+key).value=s.grade[key];$('lab-'+amount).value=s.grade[amount];$('lab-'+amount+'Value').value=s.grade[amount];}
 const canMove=available&&visible()&&!state.compare&&!$('labFilmPanel').hidden&&s.film.enabled&&s.film.leak>0;handle.hidden=!canMove;$('labMoveHint').hidden=!canMove;$('lab-leakTemperature').closest('.lab-control').hidden=!s.film.enabled||!s.film.leak;
 frame.dataset.labMoving=String(pointer!==null&&canMove);frame.classList.toggle('lab-moving',pointer!==null&&canMove);if(pointer!==null&&canMove){frame.classList.remove('holding-original');document.body.classList.remove('holding-photo');}
 const match=Object.values(presets).find(p=>JSON.stringify(p.film)===JSON.stringify(s.film)&&JSON.stringify(p.grade)===JSON.stringify(s.grade));$('labStyleDescription').textContent=match?match.description:!s.film.enabled&&!s.grade.enabled?'Sin efectos activos. Elegí un estilo o activá un componente.':'Combinación personalizada · cada componente es independiente.';for(const b of panel.querySelectorAll('[data-lab-preset]'))b.setAttribute('aria-pressed',presets[b.dataset.labPreset]===match);position();}
 window.addEventListener('resize',sync);if(typeof ResizeObserver!=='undefined')new ResizeObserver(position).observe(frame);
 sync();return {sync,selectEditor};
}
