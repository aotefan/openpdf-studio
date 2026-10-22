// Page ranges are one-based in the UI; engine indices are zero-based and sorted.
export function parsePageRange(value:string,total:number):number[]{
 if(!value.trim())return [];
 const selected=new Set<number>();
 for(const part of value.replace(/，/g,',').split(',')){
  const match=part.trim().match(/^(\d+)(?:\s*[-–]\s*(\d+))?$/);
  if(!match)throw new Error('pageRangeInvalid');
  const start=Number(match[1]),end=Number(match[2]??match[1]);
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<1||end<start||end>total)throw new Error('pageRangeInvalid');
  for(let i=start;i<=end;i++)selected.add(i-1);
 }
 return [...selected].sort((a,b)=>a-b);
}
export function formatPageRange(pages:number[]):string{
 const sorted=[...new Set(pages)].sort((a,b)=>a-b),parts:string[]=[];
 for(let i=0;i<sorted.length;i++){
  const first=sorted[i];let last=first;
  while(sorted[i+1]===last+1)last=sorted[++i];
  parts.push(first===last?String(first+1):`${first+1}-${last+1}`);
 }
 return parts.join(', ');
}

// Gap is an insertion boundary in the current order, before removing dragged pages.
export function movePages(order:number[],moving:number[],gap:number):number[]{
 if(!Number.isInteger(gap)||gap<0||gap>order.length)return order;
 const chosen=new Set(moving),group=order.filter(i=>chosen.has(i));
 if(!group.length)return order;
 const remaining=order.filter(i=>!chosen.has(i));
 const at=order.slice(0,gap).filter(i=>!chosen.has(i)).length;
 return [...remaining.slice(0,at),...group,...remaining.slice(at)];
}
export function stepPages(order:number[],moving:number[],direction:-1|1):number[]{
 const next=[...order],chosen=new Set(moving);
 if(direction===-1){for(let i=1;i<next.length;i++)if(chosen.has(next[i])&&!chosen.has(next[i-1]))[next[i-1],next[i]]=[next[i],next[i-1]]}
 else{for(let i=next.length-2;i>=0;i--)if(chosen.has(next[i])&&!chosen.has(next[i+1]))[next[i],next[i+1]]=[next[i+1],next[i]]}
 return next;
}
