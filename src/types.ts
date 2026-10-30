export type TabType = 'plan' | 'new' | 'queue' | 'settings';

export type PlanStatus = 'idea' | 'making' | 'made' | 'failed' | 'skipped';

export interface PlanItem {
  id: number;
  day: string; // YYYY-MM-DD
  topic: string;
  brief: string;
  status: PlanStatus;
  post_id?: number | null;
  refs?: Array<{ db: string; table: string; id: string | number; label?: string }>;
}

export type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed' | 'cancelled' | 'publishing';

export interface BannerSpec {
  layout: 'dark' | 'light' | 'blue';
  object: string; // case, team, play, rocket, trophy, tag, star, gem, etc.
  word?: string;
  headline: string;
  sub?: string;
  pill?: string;
  link?: string;
  style?: 'coin' | 'tiles' | 'corner' | 'steps' | '';
  points?: string[];
}

export interface PostButton {
  text: string;
  url: string;
}

export interface PostItem {
  id: number;
  status: PostStatus;
  topic: string;
  brief: string;
  refs?: Array<{ db: string; table: string; id: string | number; label?: string }>;
  html: string;
  banner: BannerSpec;
  buttons: PostButton[];
  scheduled_at?: string | null;
  created_at: string;
  channel_link?: string;
  error?: string;
  history?: string[];
}

export interface Settings {
  channel: string;
  tz: string;
  defaultTime: string;
  dailyTime: string;
  dailyEnabled: boolean;
  approver: number | null;
  customEmoji: boolean;
  links: Record<string, string>;
  stylePrompt: string;
  botToken?: string;
  adminIds?: string;
  channelId?: string;
  qwenKey?: string;
}

export interface SourceRow {
  id: string | number;
  label: string;
  preview: string;
}

export interface SourceTable {
  db: string;
  table: string;
  label: string;
  rows?: SourceRow[];
}
