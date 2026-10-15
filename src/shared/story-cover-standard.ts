// Shared by the photography directory, every story and studio cover previews.
export const storyCoverType = {
  title: { base: 88, desktop: "clamp(44px, 5.9vw, 88px)", tablet: "clamp(44px, 6.5vw, 64px)", mobile: "clamp(34px, 9.8vw, 44px)" },
  label: { base: 15, desktop: "15px", tablet: "14px", mobile: "12px" },
};

export const storyCoverCss = `
.story-editorial .story-hero { align-items: flex-end; }
.story-editorial .story-hero-shade { background: linear-gradient(0deg,rgba(5,9,9,.76),rgba(5,9,9,.32) 38%,rgba(5,9,9,.06) 78%); }
.story-editorial .story-hero-copy, .photography-page .series-feature-copy { width: calc(100% - 112px); max-width: none; margin: 0 auto; padding: 56px 0; text-align: center; text-shadow: 0 2px 18px rgba(0,0,0,.2); }
.story-editorial .story-hero .eyebrow, .photography-page .series-feature-label { margin: 0; font-size: ${storyCoverType.label.desktop}; line-height: 1.6; letter-spacing: .14em; }
.story-editorial .story-hero h1, .photography-page .series-feature-copy h2 { max-width: 1100px; margin: 18px auto 24px; font-family: "Songti SC","SimSun","STSong","Noto Serif SC",serif; font-size: ${storyCoverType.title.desktop}; font-weight: 400; line-height: 1.18; letter-spacing: .035em; text-wrap: balance; overflow-wrap: anywhere; }
.story-editorial .story-hero-meta { justify-content: center; flex-wrap: wrap; gap: 10px 28px; font-size: ${storyCoverType.label.desktop}; line-height: 1.6; letter-spacing: .12em; color: #fff; }
.photography-page .series-feature-description { margin: 0 auto 24px; text-align: center; }
.photography-page .series-feature-count { display: block; position: static; margin: 0 auto 20px; font-size: ${storyCoverType.label.desktop}; line-height: 1.6; letter-spacing: .12em; }
.story-editorial .story-hero-edit { margin-top: 20px; font-size: 14px; line-height: 1.6; }
@media(max-width:900px) {
  .story-editorial .story-hero-copy, .photography-page .series-feature-copy { width: calc(100% - 80px); padding: 44px 0; }
  .story-editorial .story-hero h1, .photography-page .series-feature-copy h2 { font-size: ${storyCoverType.title.tablet}; }
  .story-editorial .story-hero :is(.eyebrow,.story-hero-meta), .photography-page :is(.series-feature-label,.series-feature-count) { font-size: ${storyCoverType.label.tablet}; }
}
@media(max-width:760px) {
  .story-editorial .story-hero-copy, .photography-page .series-feature-copy { width: calc(100% - 40px); padding: 36px 0; }
  .story-editorial .story-hero h1, .photography-page .series-feature-copy h2 { margin: 16px auto 22px; font-size: ${storyCoverType.title.mobile}; line-height: 1.25; }
  .story-editorial .story-hero :is(.eyebrow,.story-hero-meta), .photography-page :is(.series-feature-label,.series-feature-count) { font-size: ${storyCoverType.label.mobile}; letter-spacing: .1em; }
  .story-editorial .story-hero-meta { gap: 8px 20px; }
}
`;
