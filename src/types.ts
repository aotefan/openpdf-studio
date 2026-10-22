export type Rect=[number,number,number,number];
export type Page={width:number;height:number;rotation:number};
export type Doc={id:string;name:string;revision:number;pages:Page[];bookmarks:[number,string,number][];canUndo:boolean;canRedo:boolean;log:unknown[]};
export type TextObj={id:string;text:string;rect:Rect;viewRect:Rect;origin:number[];size:number;font:string;color:string};
export type TextDraft={content:string;size:number;color:string;bold:boolean;italic:boolean;underline:boolean};
export type ImgObj={id:string;xref:number;rect:Rect;viewRect:Rect;width:number;height:number};
export type Objects={texts:TextObj[];images:ImgObj[];kind:string};
export type Op={type:string;page?:number;[key:string]:unknown};
export type OcrPage={page:number;status:string;lines:number;lowConfidence:number;sample:string};
export type OcrPlan={revision:number;pages:OcrPage[];total:number};
export type OcrProgress={job:string;pages:OcrPage[];total:number;completed:number;done:boolean};
export type Preview={markupValidated?:boolean;focusPage?:number;ocrPages?:OcrPage[];summary?:string;token:string;changes:number;warnings:string[];diff:{page:number;changed:boolean;bounds?:number[];structural?:boolean;outsideRegionChanged?:boolean}[];pages:number;revision:number};
export type Export={data:string;name:string;extension:string};
export type FileData={data:string;name:string};
declare global {interface Window{studio:{batch:(action:string,value?:string)=>Promise<BatchConversionState>;rpc<T=any>(method:string,params?:Record<string,unknown>):Promise<T>;pick(kind?:string):Promise<FileData|null>;save(result:Export):Promise<boolean>;language():Promise<string>;setLocale(lng:string):Promise<void>;onCommand(callback:(command:string)=>void):()=>void;recovery(action:string,data?:unknown):Promise<any>}}}

export type BatchConversionState={files:{name:string;size:number;output:string;status:string}[];destination:string;format:string;phase:string;completed:number;error:string;failedFile:string;result:string};

export type MarkupPlan={revision:number;total:number;duplicates:number;pages:{page:number;count:number;duplicates:number}[];operations:Op[]};
export type MarkupItem={page:number;xref:number;id:string;text:string;style:string;rect:Rect};
