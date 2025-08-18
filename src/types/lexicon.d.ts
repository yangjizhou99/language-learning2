export interface Lexicon {
  connectives: string[];
  time: string[];
  pronouns: string[];
}

declare module "../../../data/lexicon/en.json" {
  const value: Lexicon;
  export default value;
}

declare module "../../../data/lexicon/ja.json" {
  export interface Lexicon {
    connectives: string[];
    time: string[];
    pronouns: string[];
  }
  const value: Lexicon;
  export default value;
}

declare module "../../../data/lexicon/zh.json" {
  export interface Lexicon {
    connectives: string[];
    time: string[];
    pronouns: string[];
  }
  const value: Lexicon;
  export default value;
}

export interface SpanItem {
  span: [number, number];
  tag: "connective" | "time";
  surface: string;
}

export interface PronounResolution {
  pron: [number, number];
  antecedents: [number, number][];
}

export interface SVOTriple {
  s: [number, number];
  v: [number, number];
  o: [number, number];
}

export interface ClozeItem {
  start: number;
  end: number;
  answer: string;
  hint: string;
  type: string;
}
