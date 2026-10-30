import React, { useState } from 'react';
import { BannerSpec, PostItem, Settings, SourceTable } from '../types';
import { LAYOUTS, OBJECTS } from '../bannerRenderer';
import { generatePostContent } from '../postGenerator';
import { BannerPreview } from './BannerPreview';

interface NewPostTabProps {
  settings: Settings;
  sources: SourceTable[];
  onAddPost: (post: PostItem) => void;
  onOpenDraft: (post: PostItem) => void;
  showToast: (msg: string, isError?: boolean) => void;
}

export const NewPostTab: React.FC<NewPostTabProps> = ({
  settings,
  sources,
  onAddPost,
  onOpenDraft,
  showToast,
}) => {
  const [topic, setTopic] = useState('');
  const [brief, setBrief] = useState('');
  const [selectedRefs, setSelectedRefs] = useState<
    Array<{ db: string; table: string; id: string | number; label: string }>
  >([]);
  const [selectedSrcKey, setSelectedSrcKey] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [layout, setLayout] = useState<string>('');
  const [objectIcon, setObjectIcon] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showLivePreview, setShowLivePreview] = useState(true);

  const currentSource = sources.find((s) => `${s.db}|${s.table}` === selectedSrcKey);
  const filteredRows = currentSource?.rows?.filter((r) =>
    searchQuery ? r.label.toLowerCase().includes(searchQuery.toLowerCase()) : true
  ) || [];

  const handleAddRef = (row: { id: string | number; label: string }) => {
    if (!currentSource) return;
    if (selectedRefs.some((r) => r.id === row.id && r.table === currentSource.table)) return;
    setSelectedRefs([...selectedRefs, { db: currentSource.db, table: currentSource.table, id: row.id, label: row.label }]);
    showToast('Материал прикреплён');
  };

  const handleRemoveRef = (idx: number) => {
    setSelectedRefs(selectedRefs.filter((_, i) => i !== idx));
  };

  const handleCreatePost = async () => {
    if (!topic.trim()) {
      showToast('Укажи тему', true);
      return;
    }

    setIsGenerating(true);
    try {
      await new Promise((r) => setTimeout(r, 450));
      const overrides: { banner?: Partial<BannerSpec> } = {};
      if (layout) overrides.banner = { ...overrides.banner, layout: layout as any };
      if (objectIcon) overrides.banner = { ...overrides.banner, object: objectIcon };

      const gen = generatePostContent(topic, brief, selectedRefs, overrides, settings);
      const newPost: PostItem = {
        id: Date.now(),
        status: 'draft',
        topic: topic.trim(),
        brief: brief.trim(),
        refs: selectedRefs,
        html: gen.html,
        banner: gen.banner,
        buttons: gen.buttons,
        created_at: new Date().toISOString(),
      };

      onAddPost(newPost);
      setTopic('');
      setBrief('');
      setSelectedRefs([]);
      showToast('Готово! Пост создан');
      onOpenDraft(newPost);
    } catch (e: any) {
      showToast(`Ошибка: ${e.message}`, true);
    } finally {
      setIsGenerating(false);
    }
  };

  const liveBannerSpec: Partial<BannerSpec> = {
    layout: (layout as any) || 'dark',
    object: objectIcon || 'case',
    headline: topic || 'Hustlify',
    sub: brief || 'Канал Hustlify',
    pill: 'Новый пост',
    link: 'hustlify.site',
  };

  return (
    <div>
      <h2>Что делаем?</h2>

      <label>Тема</label>
      <input
        placeholder="Например: рулетка промокодов или вакансия в продажи"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
      />

      <label>Тезисы (необязательно)</label>
      <textarea
        placeholder="Что важно сказать. Без выдуманных цифр: только факты и условия."
        value={brief}
        onChange={(e) => setBrief(e.target.value)}
      />

      <label>Материал из баз (каталог, кейсы, партнёры, проекты, портфолио…)</label>
      {selectedRefs.length > 0 && (
        <div id="chips" style={{ marginBottom: 8 }}>
          {selectedRefs.map((r, i) => (
            <span className="chip" key={i}>
              {r.label}
              <button onClick={() => handleRemoveRef(i)}>✕</button>
            </span>
          ))}
        </div>
      )}

      {sources.length > 0 ? (
        <>
          <div className="row">
            <select
              className="grow"
              value={selectedSrcKey}
              onChange={(e) => setSelectedSrcKey(e.target.value)}
            >
              <option value="">Выбери таблицу материалов…</option>
              {sources.map((s) => (
                <option key={`${s.db}|${s.table}`} value={`${s.db}|${s.table}`}>
                  {s.db} · {s.label} ({s.table})
                </option>
              ))}
            </select>
          </div>

          {selectedSrcKey && (
            <>
              <div className="row nw" style={{ marginTop: 8 }}>
                <input
                  className="grow"
                  placeholder="Поиск по названию"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div id="rows" style={{ marginTop: 8, maxHeight: 180, overflowY: 'auto' }}>
                {filteredRows.map((r) => (
                  <div className="src" key={r.id}>
                    <div className="t">
                      <b>{r.label}</b>
                      <span className="muted small">{r.preview.slice(0, 70)}</span>
                    </div>
                    <button className="b s" onClick={() => handleAddRef(r)}>
                      +
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <div className="muted small">Базы материалов не подключены.</div>
      )}

      <label>Баннер</label>
      <div className="row">
        <select className="grow" value={layout} onChange={(e) => setLayout(e.target.value)}>
          <option value="">Фон: авто</option>
          {Object.entries(LAYOUTS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>

      <div className="row" style={{ marginTop: 8 }}>
        <select className="grow" value={objectIcon} onChange={(e) => setObjectIcon(e.target.value)}>
          <option value="">Иконка: авто</option>
          {Object.entries(OBJECTS).map(([k, v]) => (
            <option key={k} value={k}>
              {k} — {v}
            </option>
          ))}
        </select>
      </div>

      {showLivePreview && topic && (
        <div style={{ marginTop: 14 }}>
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
            <span className="muted small">Предпросмотр баннера</span>
            <button
              className="b s g"
              style={{ padding: '2px 8px', fontSize: '11px' }}
              onClick={() => setShowLivePreview(false)}
            >
              Скрыть
            </button>
          </div>
          <BannerPreview spec={liveBannerSpec} />
        </div>
      )}

      <div style={{ height: 16 }} />

      <button
        className="b grow"
        style={{ width: '100%' }}
        disabled={isGenerating}
        onClick={handleCreatePost}
      >
        {isGenerating ? 'Пишу пост и рисую баннер…' : 'Сделать пост и прислать в чат'}
      </button>

      <div className="muted small" style={{ marginTop: 10, textAlign: 'center' }}>
        Бот подготовит фото, пост с типографикой и блок кнопок «Название - Ссылка».
      </div>
    </div>
  );
};
