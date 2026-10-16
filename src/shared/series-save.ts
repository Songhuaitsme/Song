import type { Photo, Series, SiteContent } from "@/shared/content-model";
import { seriesPhotoOrder } from "@/shared/series-layout-operations";
import { sameStudioValue } from "@/shared/studio-list";

const photoFields=["alt","caption","location","takenAt"] as const;
const seriesFields=["title","slug","description","coverUrl","access","sortOrder","narrative","layout","draftPhotoOrder"] as const;
export type SeriesSaveResult = {
  series: Omit<Series,"photos">;
  photoEdits: Pick<Photo,"id"|"alt"|"caption"|"location"|"takenAt">[];
  photoOrder: {id:string;sortOrder:number;version:number;updatedAt?:number}[];
};
export function entireSeriesPayload(series:Series){
  return {...series,layout:series.layout??null,photoOrder:seriesPhotoOrder(series),photos:series.photos.map(photo=>({id:photo.id,seriesId:series.id,version:photo.version,...Object.fromEntries(photoFields.map(key=>[key,photo[key]]))}))};
}
/** Acknowledge exactly the submitted snapshot, keeping anything typed during the request dirty. */
export function applyEntireSeriesSave(content:SiteContent,snapshot:Series,result:SeriesSaveResult,preserveNewer:boolean):SiteContent{
  const edits=new Map(result.photoEdits.map(photo=>[photo.id,photo])),order=new Map(result.photoOrder.map(photo=>[photo.id,photo]));
  const saved:Series={...snapshot,...result.series,photos:snapshot.photos.map(photo=>{const meta=order.get(photo.id)!;return {...photo,...edits.get(photo.id),...meta,updatedAt:meta.updatedAt??photo.updatedAt};}).sort((a,b)=>a.sortOrder-b.sortOrder)};
  delete saved.draftPhotoOrder;
  const current=content.series.find(series=>series.id===snapshot.id);
  let merged=saved;
  if(preserveNewer&&current){
    merged={...current,version:saved.version,updatedAt:saved.updatedAt};
    for(const key of seriesFields)if(sameStudioValue(current[key],snapshot[key]))Object.assign(merged,{[key]:saved[key]});
    const submitted=new Map(snapshot.photos.map(photo=>[photo.id,photo])),committed=new Map(saved.photos.map(photo=>[photo.id,photo]));
    merged.photos=current.photos.map(photo=>{const before=submitted.get(photo.id),after=committed.get(photo.id);if(!before||!after)return photo;const next={...photo,version:after.version,updatedAt:after.updatedAt,sortOrder:after.sortOrder};for(const key of photoFields)if(photo[key]===before[key])next[key]=after[key];return next;}).sort((a,b)=>a.sortOrder-b.sortOrder);
    if(merged.draftPhotoOrder===undefined)delete merged.draftPhotoOrder;
  }
  return {...content,series:current?content.series.map(series=>series.id===snapshot.id?merged:series):[...content.series,merged]};
}
