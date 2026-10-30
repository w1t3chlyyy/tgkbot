import React, { useState } from 'react';
import { BannerSpec, PostItem, Settings } from '../types';
import { BannerPreview } from './BannerPreview';
import { normalizeBannerSpec, OBJECTS } from '../bannerRenderer';

interface DraftModalProps {
  post: PostItem;
  settings: Settings;
  onClose: () => void;
  onUpdate: (updatedPost: PostItem) => void;
  onPublish: (post: PostItem) => void;
  showToast: (msg: string, isError?: boolean) => void;
}

export const DraftModal: React.FC<DraftModalProps> = ({
  post,
  onClose,
  onUpdate,
  onPublish,
  showToast,
}) => {
  const [instruction, setInstruction] = useState('');
  const [isRevising, setIsRevising] = useState(false);
  const [activeMenu, setActiveMenu] = useState<'main' | 'banner' | 'text'>('main');
  const [editableHtml, setEditableHtml] = useState(post.html);

  const handleCopyButtons = () => {
    const text = post.buttons.map((b) => `${b.text} - ${b.url}`).join('\n');
    navigator.clipboard.writeText(text);
    showToast('Кнопки скопированы');
  };

  const handleCopyText = () => {
    const clean = post.html.replace(/<[^>]+>/g, '');
    navigator.clipboard.writeText(clean);
    showToast('Текст поста скопирован');
  };

  const handleCycleLayout = () => {
    const layouts: Array<'dark' | 'light' | 'blue'> = ['dark', 'light', 'blue'];
    const curIdx = layouts.indexOf(post.banner.layout || 'dark');
    const next = layouts[(curIdx + 1) % layouts.length];
    const updatedBanner: BannerSpec = normalizeBannerSpec({ ...post.banner, layout: next });
    onUpdate({ ...post, banner: updatedBanner });
    showToast(`Фон изменён: ${next}`);
  };

  const handleCycleObject = () => {
    const keys = Object.keys(OBJECTS);
    const curIdx = keys.indexOf(post.banner.object || 'case');
    const next = keys[(curIdx + 1) % keys.length];
    const updatedBanner: BannerSpec = normalizeBannerSpec({ ...post.banner, object: next });
    onUpdate({ ...post, banner: updatedBanner });
    showToast(`Иконка изменена: ${next}`);
  };

  const handleApplyInstruction = () => {
    if (!instruction.trim()) {
      showToast('Введи текст правки', true);
      return;
    }
    setIsRevising(true);
    setTimeout(() => {
      let revisedHtml = post.html;
      const lower = instruction.toLowerCase();

      if (/короче|сократи/.test(lower)) {
        const parts = revisedHtml.split('\n\n');
        revisedHtml = parts.slice(0, Math.max(2, parts.length - 1)).join('\n\n');
      } else if (/скидк|цена/.test(lower)) {
        revisedHtml += '\n\n<blockquote>Специальное предложение действует только до конца недели.</blockquote>';
      } else if (/24 час|дедлайн|срочн/.test(lower)) {
        revisedHtml += '\n\n<blockquote>Предложение ограничено: доступно только следующие 24 часа.</blockquote>';
      } else {
        revisedHtml = `${revisedHtml}\n\n<i>${instruction}</i>`;
      }

      const updated = {
        ...post,
        html: revisedHtml,
        history: [...(post.history || []), instruction],
      };
      onUpdate(updated);
      setInstruction('');
      setIsRevising(false);
      showToast('Правки внесены');
    }, 400);
  };

  const handleSaveTextEdit = () => {
    onUpdate({ ...post, html: editableHtml });
    setActiveMenu('main');
    showToast('Текст сохранён');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">Пост #{post.id}</div>
          <button className="modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <BannerPreview spec={post.banner} allowDownload={true} />

          {activeMenu === 'text' ? (
            <div style={{ marginTop: 12 }}>
              <label>Редактирование HTML поста</label>
              <textarea
                value={editableHtml}
                onChange={(e) => setEditableHtml(e.target.value)}
                style={{ minHeight: 180, fontFamily: 'monospace', fontSize: 13 }}
              />
              <div className="row" style={{ marginTop: 10 }}>
                <button className="b grow" onClick={handleSaveTextEdit}>
                  Сохранить текст
                </button>
                <button className="b g" onClick={() => setActiveMenu('main')}>
                  Отмена
                </button>
              </div>
            </div>
          ) : (
            <>
              <div
                className="post-content-view"
                dangerouslySetInnerHTML={{ __html: post.html }}
              />

              {post.buttons.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div className="row" style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                    <label style={{ margin: 0 }}>Кнопки под пост</label>
                    <button className="b s g" onClick={handleCopyButtons}>
                      Скопировать кнопки
                    </button>
                  </div>
                  <div className="buttons-preview">
                    {post.buttons.map((b, i) => (
                      <a key={i} href={b.url} target="_blank" rel="noreferrer" className="tg-btn-link">
                        {b.text} ↗
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginTop: 16 }}>
                <div className="row" style={{ gap: 8, marginBottom: 12 }}>
                  <button className="b s g grow" onClick={handleCopyText}>
                    📋 Скопировать текст
                  </button>
                  <button className="b s g grow" onClick={() => setActiveMenu('text')}>
                    ✏️ Править вручную
                  </button>
                </div>

                <div className="card" style={{ padding: 10, background: '#090a0d', marginBottom: 12 }}>
                  <div className="small muted" style={{ marginBottom: 8, fontWeight: 600 }}>
                    Быстрые правки баннера
                  </div>
                  <div className="row">
                    <button className="b s g" onClick={handleCycleLayout}>
                      Фон: {post.banner.layout || 'dark'} ⇄
                    </button>
                    <button className="b s g" onClick={handleCycleObject}>
                      Иконка: {post.banner.object || 'case'} ⇄
                    </button>
                  </div>
                </div>

                <div className="row nw" style={{ gap: 8 }}>
                  <input
                    placeholder="Правка («короче», «добавь дедлайн 24 часа»…)"
                    value={instruction}
                    onChange={(e) => setInstruction(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleApplyInstruction()}
                  />
                  <button
                    className="b g"
                    style={{ whiteSpace: 'nowrap' }}
                    onClick={handleApplyInstruction}
                    disabled={isRevising}
                  >
                    {isRevising ? 'Вношу…' : 'Применить'}
                  </button>
                </div>
              </div>

              <div style={{ height: 16 }} />

              <div className="row">
                <button
                  className="b w grow"
                  onClick={() => {
                    onPublish(post);
                    onClose();
                  }}
                >
                  {post.status === 'published' ? 'Опубликован ✅' : 'Опубликовать сейчас'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
