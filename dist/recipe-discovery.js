export const sceneLabels={portrait:'Retrato',landscape:'Paisaje',city:'Ciudad y calle',night:'Noche',everyday:'Día a día',versatile:'Versátiles'};
export const lookLabels={warm:'Cálidos',cool:'Fríos',neutral:'Neutros',soft:'Suaves',deep:'Profundos',dark:'Oscuros',mono:'Blanco y negro'};
const descriptions={warm:'Cálido',cool:'Frío',neutral:'Neutro',soft:'Suave',deep:'Profundo',dark:'Oscuro',mono:'Blanco y negro'};
// Editorial recommendations for Film Lab's catalog, independent of the user's
// file. A recipe can suit more than one scene and have several visible traits.
const groups={
 neutral:[['versatile'],['neutral']],
 gold:[['portrait','landscape'],['warm','soft']],
 chrome:[['city','landscape'],['neutral','deep']],
 soft:[['portrait'],['neutral','soft']],
 negative:[['city','night'],['cool','deep']],
 mono:[['city','portrait'],['mono','deep']],
 'nostalgic-summer':[['landscape','everyday','portrait'],['warm']],
 'editorial-0':[['portrait','everyday'],['warm','deep']],
 'editorial-1':[['portrait','everyday'],['warm','soft']],
 'editorial-2':[['everyday','portrait'],['neutral','deep']],
 'editorial-3':[['portrait'],['warm','soft']],
 'editorial-4':[['city','night','landscape'],['cool','deep']],
 'editorial-5':[['night','portrait'],['warm','dark','deep']],
 'editorial-6':[['everyday'],['neutral']],
 'editorial-7':[['portrait'],['neutral','soft']],
 'editorial-8':[['landscape','everyday'],['warm','deep']],
 'editorial-9':[['night','city'],['cool','dark','deep']],
 'editorial-10':[['portrait'],['warm','soft']],
 'editorial-11':[['everyday','portrait'],['mono','soft']],
 botanica:[['portrait','landscape'],['warm','deep']],
 'flash-diario':[['everyday','portrait'],['neutral','deep']],
 'plata-editorial':[['portrait','city'],['mono','deep']],
 'bronce-salino':[['portrait','landscape'],['warm','deep']],
 'piel-seda':[['portrait'],['warm','soft']],
 'plata-marina':[['landscape','portrait'],['cool','deep']],
 'costa-editorial':[['landscape','portrait'],['cool','deep']],
 'online-amber-print':[['everyday','portrait'],['warm','soft']],
 'online-coastal-blue':[['landscape'],['cool','soft']],
 'online-dusty-rose':[['portrait'],['neutral','soft']],
 'online-forest-walk':[['landscape'],['warm','deep','dark']],
 'online-pastel-morning':[['portrait','landscape'],['neutral','soft']],
 'online-cinema-teal':[['city','night'],['cool','deep','dark']],
 'online-desert-light':[['landscape','portrait'],['warm','soft']],
 'online-rainy-city':[['city'],['cool','deep']],
 'online-soft-wedding':[['portrait'],['warm','soft']],
 'online-autumn-paper':[['landscape','everyday'],['warm','soft']],
 'online-night-neon':[['night','city'],['cool','deep','dark']],
 'online-clean-travel':[['landscape','everyday'],['neutral']],
 'online-faded-denim':[['city','everyday'],['cool','soft']],
 'online-warm-portrait':[['portrait'],['warm','soft']],
 'online-noir-street':[['city','night'],['mono','dark','deep']],
 'online-soft-silver':[['portrait'],['mono','soft']],
 'online-sepia-notes':[['everyday','portrait'],['warm','soft']],
 'online-summer-postcard':[['landscape','everyday'],['warm']],
 'online-studio-neutral':[['portrait'],['neutral','soft']],
 'online-deep-woodland':[['landscape'],['neutral','dark','deep']]
};
export function recipeRecommendation(recipe){
 const known=groups[recipe.id];if(known)return {scenes:[...known[0]],looks:[...known[1]],curated:true};
 const s=recipe.settings||{},looks=[];
 if(s.mono>0)looks.push('mono');else looks.push(s.temperature>8?'warm':s.temperature< -8?'cool':'neutral');
 if(s.contrast< -5||s.shadows>10)looks.push('soft');
 if(s.contrast>=18||s.blacks< -10||s.shadows< -10)looks.push('deep');
 if(s.exposure< -.1||s.blacks< -18||s.shadows< -18)looks.push('dark');
 return {scenes:['versatile'],looks,curated:false};
}
export function matchesRecommendation(recipe,scene='all',look='all'){
 const rec=recipeRecommendation(recipe);return (scene==='all'||rec.scenes.includes(scene))&&(look==='all'||rec.looks.includes(look));
}
export function recommendationCaption(recipe,scene='all',look='all'){
 const rec=recipeRecommendation(recipe),chosenScene=rec.scenes.includes(scene)?scene:rec.scenes[0],chosenLook=rec.looks.includes(look)?look:rec.looks[0];
 return `${sceneLabels[chosenScene]} · ${descriptions[chosenLook]}`;
}
export function discoveryGroups(recipes,scene='all',look='all'){
 const filtered=recipes.filter(r=>matchesRecommendation(r,scene,look));
 if(scene!=='all')return filtered.length?[{id:scene,title:sceneLabels[scene]+(look!=='all'?' · '+lookLabels[look].toLowerCase():''),recipes:filtered}]:[];
 return ['versatile','portrait','landscape','city','night','everyday'].map(id=>({id,title:sceneLabels[id],recipes:filtered.filter(r=>recipeRecommendation(r).scenes[0]===id)})).filter(group=>group.recipes.length);
}
export function mountRecipeDiscovery({onChange}){
 const $=id=>document.getElementById(id),box=document.createElement('div');box.id='recipeDiscovery';box.className='recipe-discovery';
 box.innerHTML='<div class="discovery-fields"><label class="field">Para qué foto<select id="recipeScene"><option value="all">Todas las escenas</option></select></label><label class="field">Qué estilo buscás<select id="recipeLook"><option value="all">Todos los estilos</option></select></label></div><p class="tiny muted">Sugerencias para elegir; podés usar cualquier filtro en cualquier foto.</p><button type="button" id="clearDiscovery" class="text-button" hidden>Ver todas las sugerencias</button>';
 document.querySelector('#recipesPanel .filter-tabs').after(box);
 for(const [id,labels]of [['recipeScene',sceneLabels],['recipeLook',lookLabels]])for(const [value,title]of Object.entries(labels)){const option=document.createElement('option');option.value=value;option.textContent=title;$(id).append(option);}
 for(const id of ['recipeScene','recipeLook'])$(id).onchange=()=>{sync();onChange();};
 $('clearDiscovery').onclick=()=>{$('recipeScene').value=$('recipeLook').value='all';sync();onChange();};
 function selection(){return {scene:$('recipeScene').value,look:$('recipeLook').value};}
 function sync(){const {scene,look}=selection();$('clearDiscovery').hidden=scene==='all'&&look==='all';}
 return {selection,sync};
}
