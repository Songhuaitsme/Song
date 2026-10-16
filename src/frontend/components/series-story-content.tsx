"use client";

import type { Series } from "@/shared/content-model";
import { EditableText } from "./editable-text";
import { PhotoStory } from "./photo-story";

export function SeriesStoryContent({ series, editor, labels, ledeLabel = "摄影系列" }: {
  series: Series; editor?: { enabled: boolean; csrf: string };
  labels?: { close: string; prev: string; next: string }; ledeLabel?: string;
}) {
  const narrative = series.narrative;
  const intro = narrative?.intro.trim() ? narrative.intro : series.description;
  const writingLink = `/studio?tab=series#series-text-${series.id}`;
  return <>
    {(intro.trim() || editor?.enabled) && <div className="story-lede">
      {ledeLabel && <p className="story-lede-label" data-text-page="story" data-text-role="label"><EditableText textPage="story" textRole="label" value={ledeLabel} field="storyLede" enabled={editor?.enabled ?? false} csrf={editor?.csrf ?? ""}/></p>}
      {narrative?.intro.trim() ? <div className="story-intro">{intro.split(/\n\s*\n/).map((paragraph, index) => <p key={index} className="story-lede-summary" data-text-page="story" data-text-role="summary">{paragraph}</p>)}</div> : <p className="story-lede-summary" data-text-page="story" data-text-role="summary"><EditableText textPage="story" textRole="summary" value={series.description || "添加系列导语或简介"} editValue={series.description} field="description" entity="series" id={series.id} enabled={editor?.enabled ?? false} csrf={editor?.csrf ?? ""}/></p>}
      {editor?.enabled && <a className="story-writing-link" data-text-page="story" data-text-role="link" href={writingLink}>编辑系列文字</a>}
    </div>}
    <PhotoStory photos={series.photos} chapters={narrative?.chapters} seriesId={series.id} editor={editor} labels={labels}/>
    {narrative?.closing.trim() && <div className="story-closing">
      <p className="story-closing-label" data-text-page="story" data-text-role="label">写在最后</p>
      <div className="story-prose">{narrative.closing.split(/\n\s*\n/).map((paragraph, index) => <p key={index} data-text-page="story" data-text-role="body">{paragraph}</p>)}</div>
      {editor?.enabled && <a className="story-writing-link" data-text-page="story" data-text-role="link" href={writingLink}>编辑系列收尾</a>}
    </div>}
  </>;
}
