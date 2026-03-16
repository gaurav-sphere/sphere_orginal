import React from "react";

/* ══════════════════════════════════════════════════════════════
   SPHERE — categories.ts
   Single source of truth for all categories across the app.

   DB CHECK constraint on posts.category allows:
   top, city, sports, science, entertainment, world,
   tech, politics, music, food, other

   UI shows 7 categories. 'national' removed — 'politics'
   is the correct DB value. All other DB categories (tech,
   music, food, other) are valid for posts but not shown
   as feed tabs — they appear in search trending only.
══════════════════════════════════════════════════════════════ */

export type IconProps = { size?: number; className?: string };

const ic = (d: string) =>
  ({ size = 20, className = "" }: IconProps) => (
    React.createElement("svg", {
      width: size, height: size,
      viewBox: "0 0 24 24", fill: "none",
      stroke: "currentColor", strokeWidth: "1.6",
      strokeLinecap: "round", strokeLinejoin: "round",
      className,
    }, React.createElement("path", { d }))
  );

/* ── Category icons ── */
export const IcoFire     = ic("M12 2C6 8 4 12 6.5 15.5c1 1.5 2.5 2.5 5 2.5h1c2.5 0 4.5-1.5 5-4 .5-2.5-1-5-2.5-7-1 2-2.5 3-2.5 3S13 9 12 2z");
export const IcoTrophy   = ic("M8 21h8M12 17v4M6 3H3v4a6 6 0 006 6h6a6 6 0 006-6V3h-3M6 3h12");
export const IcoFlask    = ic("M9 3h6M9 3v5l-5 9a1 1 0 00.9 1.5h14.2A1 1 0 0020 17l-5-9V3");
export const IcoTV       = ic("M21 7H3a1 1 0 00-1 1v10a1 1 0 001 1h18a1 1 0 001-1V8a1 1 0 00-1-1zM8 21h8M12 17v4");
export const IcoPolitics = ic("M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5");

export const IcoBuildings = ({ size = 20, className = "" }: IconProps) =>
  React.createElement("svg", {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: "1.6",
    strokeLinecap: "round", strokeLinejoin: "round", className,
  },
    React.createElement("rect", { x: "3",  y: "7",  width: "10", height: "14", rx: "1" }),
    React.createElement("rect", { x: "13", y: "3",  width: "8",  height: "18", rx: "1" }),
    React.createElement("line", { x1: "7",  y1: "11", x2: "7",  y2: "11" }),
    React.createElement("line", { x1: "7",  y1: "14", x2: "7",  y2: "14" }),
    React.createElement("line", { x1: "17", y1: "7",  x2: "17", y2: "7"  }),
    React.createElement("line", { x1: "17", y1: "11", x2: "17", y2: "11" }),
    React.createElement("line", { x1: "17", y1: "15", x2: "17", y2: "15" }),
  );

export const IcoGlobe = ({ size = 20, className = "" }: IconProps) =>
  React.createElement("svg", {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: "1.6",
    strokeLinecap: "round", strokeLinejoin: "round", className,
  },
    React.createElement("circle", { cx: "12", cy: "12", r: "10" }),
    React.createElement("line",   { x1: "2",  y1: "12", x2: "22", y2: "12" }),
    React.createElement("path",   { d: "M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" }),
  );

/* ── Utility icons ── */
export const IcoMoon      = ic("M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z");
export const IcoHelp      = ic("M12 22a10 10 0 110-20 10 10 0 010 20zM9.09 9a3 3 0 015.83 1c0 2-3 3-3 3M12 17h.01");
export const IcoHome      = ic("M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5zM9 21V12h6v9");
export const IcoSearch    = ic("M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.35-4.35");
export const IcoMapPin    = ic("M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z M12 10a2 2 0 100-4 2 2 0 000 4z");
export const IcoArrowLeft = ic("M19 12H5M12 5l-7 7 7 7");

export const IcoSun = ({ size = 20, className = "" }: IconProps) =>
  React.createElement("svg", {
    width: size, height: size, viewBox: "0 0 24 24", fill: "none",
    stroke: "currentColor", strokeWidth: "1.6",
    strokeLinecap: "round", strokeLinejoin: "round", className,
  },
    React.createElement("circle", { cx: "12", cy: "12", r: "5" }),
    React.createElement("line", { x1: "12",    y1: "1",     x2: "12",    y2: "3"      }),
    React.createElement("line", { x1: "12",    y1: "21",    x2: "12",    y2: "23"     }),
    React.createElement("line", { x1: "4.22",  y1: "4.22",  x2: "5.64",  y2: "5.64"  }),
    React.createElement("line", { x1: "18.36", y1: "18.36", x2: "19.78", y2: "19.78" }),
    React.createElement("line", { x1: "1",     y1: "12",    x2: "3",     y2: "12"     }),
    React.createElement("line", { x1: "21",    y1: "12",    x2: "23",    y2: "12"     }),
    React.createElement("line", { x1: "4.22",  y1: "19.78", x2: "5.64",  y2: "18.36" }),
    React.createElement("line", { x1: "18.36", y1: "5.64",  x2: "19.78", y2: "4.22"  }),
  );

/* ══════════════════════════════════════════════════════════════
   CATEGORY DEFINITIONS
   id must match DB CHECK constraint values exactly.
══════════════════════════════════════════════════════════════ */
export interface Category {
  id:       string;
  label:    string;
  Icon:     React.ComponentType<IconProps>;
  keywords: string[];
}

export const CATEGORIES: Category[] = [
  {
    id: "top",
    label: "Top",
    Icon: IcoFire,
    keywords: [], // no filter — ranked by engagement + recency
  },
  {
    id: "city",
    label: "City",
    Icon: IcoBuildings,
    keywords: [
      "city","local","municipality","metro","town","village","ward",
      "mumbai","delhi","bangalore","bengaluru","chennai","kolkata",
      "hyderabad","pune","ahmedabad","jaipur","surat","lucknow",
      "kanpur","nagpur","indore","bhopal","patna","vadodara","kochi",
      "chandigarh","guwahati","bhubaneswar","coimbatore","visakhapatnam",
    ],
  },
  {
    id: "sports",
    label: "Sports",
    Icon: IcoTrophy,
    keywords: [
      "cricket","ipl","bcci","football","soccer","hockey","kabaddi",
      "badminton","tennis","basketball","wrestling","boxing","athletics",
      "olympics","cwg","fifa","uefa","nba","f1","formula1","motogp",
      "chess","esports","match","tournament","league","worldcup","t20",
      "odi","test","virat","rohit","dhoni","messi","ronaldo","sports",
    ],
  },
  {
    id: "science",
    label: "Science & Tech",
    Icon: IcoFlask,
    keywords: [
      "science","tech","technology","ai","artificialintelligence","ml",
      "deeplearning","chatgpt","openai","isro","nasa","space","rocket",
      "satellite","physics","chemistry","biology","research","innovation",
      "startup","coding","programming","javascript","python","app",
      "software","hardware","gadget","phone","laptop","electric","ev",
      "medicine","vaccine","health",
    ],
  },
  {
    id: "entertainment",
    label: "Entertainment",
    Icon: IcoTV,
    keywords: [
      "bollywood","hollywood","movie","film","series","web","netflix",
      "amazon","hotstar","ott","music","song","album","concert","artist",
      "singer","actor","actress","celebrity","drama","comedy","thriller",
      "anime","manga","meme","viral","trending","youtube","instagram",
      "reel","tiktok","podcast","book","novel","entertainment",
    ],
  },
  {
    id: "politics",  // ← was "national" — DB constraint uses "politics"
    label: "Politics",
    Icon: IcoPolitics,
    keywords: [
      "india","politics","government","parliament","modi","bjp","congress",
      "election","vote","policy","law","court","supreme","highcourt",
      "constitution","budget","economy","gdp","rbi","sebi","army",
      "military","defence","border","kashmir","northeast","flood",
      "disaster","relief","protest","movement","social","rights","national",
    ],
  },
  {
    id: "world",
    label: "World",
    Icon: IcoGlobe,
    keywords: [
      "world","global","international","usa","uk","china","russia",
      "pakistan","europe","africa","middleeast","war","peace","un","nato",
      "g20","g7","imf","worldbank","trade","sanctions","diplomacy",
      "humanrights","refugee","migration","climate","cop","summit",
    ],
  },
];

/* ══════════════════════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════════════════════ */

export function getCategoryFromText(text: string): string {
  const lower   = text.toLowerCase().replace(/#/g, " ");
  const words   = lower.match(/\b\w+\b/g) ?? [];
  const wordSet = new Set(words);
  let bestId    = "top";
  let bestScore = 0;
  for (const cat of CATEGORIES) {
    if (cat.id === "top") continue;
    let score = 0;
    for (const kw of cat.keywords) { if (wordSet.has(kw)) score++; }
    if (score > bestScore) { bestScore = score; bestId = cat.id; }
  }
  return bestId;
}

export function getCategoryById(id: string): Category {
  return CATEGORIES.find(c => c.id === id) ?? CATEGORIES[0];
}

export function isValidCategory(id: string): boolean {
  return CATEGORIES.some(c => c.id === id);
}

/* Canonical quote URL — all quote links use this */
export const quoteUrl = (id: string) => `/quote/${id}`;
