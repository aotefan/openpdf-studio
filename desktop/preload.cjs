const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('studio',{
 batch:(action,value)=>ipcRenderer.invoke('batch-conversion',action,value),
 rpc:(method,params)=>ipcRenderer.invoke('rpc',method,params),
 pick:kind=>ipcRenderer.invoke('pick',kind),save:result=>ipcRenderer.invoke('save',result),
 language:()=>ipcRenderer.invoke('language'),setLocale:lng=>ipcRenderer.invoke('set-locale',lng),onCommand:callback=>{const fn=(_event,command)=>callback(command);ipcRenderer.on('menu-command',fn);return()=>ipcRenderer.removeListener('menu-command',fn)},recovery:(action,data)=>ipcRenderer.invoke('recovery',action,data)
});
