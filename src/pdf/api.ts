import type {Doc,Export,Op,Preview,Objects} from '../types';
export const api={
 info:(sid:string)=>window.studio.rpc<Doc>('info',{sid}),
 objects:(sid:string,page:number)=>window.studio.rpc<Objects>('objects',{sid,page}),
 render:(sid:string,page:number,scale=1,preview?:string)=>window.studio.rpc<{image:string;width:number;height:number}>('render',{sid,page,scale,preview}),
 preview:(sid:string,operations:Op[])=>window.studio.rpc<Preview>('preview',{sid,operations}),
 commit:(sid:string,token:string)=>window.studio.rpc<Doc>('commit',{sid,token}),
 export:(sid:string,format='pdf',pages?:number[])=>window.studio.rpc<Export>('export',{sid,format,pages})
};
