-- Своя база бота. Выполни в Supabase → SQL Editor.
create table if not exists posts (
  id bigserial primary key,
  status text not null default 'draft',          -- draft | scheduled | publishing | published | cancelled | failed
  topic text not null default '',
  brief text not null default '',
  refs jsonb not null default '[]',               -- источники: [{db,table,id}]
  html text not null default '',
  banner jsonb not null default '{}',
  buttons jsonb not null default '[]',
  scheduled_at timestamptz,
  published_at timestamptz,
  channel_msg_ids jsonb,
  channel_link text,
  admin_chat_id bigint,
  preview jsonb not null default '{}',             -- id сообщений-превью в чате админа
  history jsonb not null default '[]',             -- правки (инструкции) для истории
  error text,
  created_at timestamptz not null default now()
);
create index if not exists posts_due on posts (status, scheduled_at);

create table if not exists plan_items (
  id bigserial primary key,
  day date not null,
  topic text not null,
  brief text not null default '',
  refs jsonb not null default '[]',
  status text not null default 'idea',            -- idea | made | skipped
  post_id bigint,
  created_at timestamptz not null default now()
);

create table if not exists settings (key text primary key, value jsonb not null);

create table if not exists emoji (
  custom_emoji_id text primary key,
  emoji text not null,
  pack text not null default '',
  idx int not null default 0
);
create index if not exists emoji_by_char on emoji (emoji, idx);

alter table posts enable row level security;
alter table plan_items enable row level security;
alter table settings enable row level security;
alter table emoji enable row level security;
-- политик нет намеренно: доступ только по service_role с сервера
