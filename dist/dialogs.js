const queue=[];let active=null;
export function confirmAction(message,{title='¿Continuamos?',confirmLabel='Confirmar',cancelLabel='Cancelar',danger=false}={}){
 return new Promise(resolve=>{queue.push({message,title,confirmLabel,cancelLabel,danger,resolve,focus:document.activeElement});showNext();});
}
function showNext(){if(active||!queue.length)return;active=queue.shift();const dialog=document.getElementById('confirmDialog');document.getElementById('confirmTitle').textContent=active.title;document.getElementById('confirmMessage').textContent=active.message;const yes=document.getElementById('confirmYes'),no=document.getElementById('confirmNo');yes.textContent=active.confirmLabel;yes.classList.toggle('danger',active.danger);no.textContent=active.cancelLabel;yes.onclick=()=>finish(true);no.onclick=()=>finish(false);document.getElementById('confirmClose').onclick=()=>finish(false);dialog.oncancel=e=>{e.preventDefault();finish(false);};dialog.showModal();no.focus();}
function finish(result){const job=active;if(!job)return;active=null;document.getElementById('confirmDialog').close();job.resolve(result);job.focus?.isConnected&&job.focus.focus?.();showNext();}
