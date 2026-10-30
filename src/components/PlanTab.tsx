import React, { useState } from 'react';
import { PlanItem, PostItem, Settings, SourceTable } from '../types';
import { makePostFromPlanItem } from '../postGenerator';
import { parsePastedPlan, generatePlanItems } from '../planParser';

interface PlanTabProps {
  plan: PlanItem[];
  settings: Settings;
  sources: SourceTable[];
  onUpdatePlan: (newPlan: PlanItem[]) => void;
  onAddPost: (post: PostItem) => void;
  onOpenDraft: (post: PostItem) => void;
  showToast: (msg: string, isError?: boolean) => void;
  posts: PostItem[];
}

export const PlanTab: React.FC<PlanTabProps> = ({
  plan,
  settings,
  sources,
  onUpdatePlan,
  onAddPost,
  onOpenDraft,
  showToast,
  posts,
}) => {
  const [makingId, setMakingId] = useState<number | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [daysCount, setDaysCount] = useState(14);
  const [focusText, setFocusText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const STATUS_LABELS: Record<string, string> = {
    idea: 'ждёт',
    making: 'готовлю…',
    made: 'пост сделан',
    failed: 'ошибка',
    skipped: 'пропущен',
  };

  const handleMakeNow = async (item: PlanItem) => {
    setMakingId(item.id);
    try {
      // Simulate quick natural processing time
      await new Promise((r) => setTimeout(r, 400));
      const { post, updatedItem } = await makePostFromPlanItem(item, settings);

      onAddPost(post);
      const updatedPlan = plan.map((p) => (p.id === item.id ? updatedItem : p));
      onUpdatePlan(updatedPlan);

      showToast('Готово! Пост подготовлен');
      onOpenDraft(post);
    } catch (e: any) {
      showToast(`Ошибка: ${e?.message || 'Не удалось сделать пост'}`, true);
      const updatedPlan = plan.map((p) => (p.id === item.id ? { ...p, status: 'failed' as const } : p));
      onUpdatePlan(updatedPlan);
    } finally {
      setMakingId(null);
    }
  };

  const handleDeleteItem = (id: number) => {
    const updated = plan.filter((p) => p.id !== id);
    onUpdatePlan(updated);
    showToast('Пункт убран из плана');
  };

  const handleImportPlan = () => {
    if (!pasteText.trim()) {
      showToast('Вставь текст плана', true);
      return;
    }
    setIsImporting(true);
    try {
      const parsed = parsePastedPlan(pasteText);
      if (!parsed.length) {
        showToast('Не удалось распознать посты в тексте', true);
        return;
      }
      onUpdatePlan([...plan, ...parsed]);
      setPasteText('');
      showToast(`Принято постов: ${parsed.length}`);
    } catch (e: any) {
      showToast(`Ошибка: ${e.message}`, true);
    } finally {
      setIsImporting(false);
    }
  };

  const handleGeneratePlan = () => {
    setIsGenerating(true);
    setTimeout(() => {
      try {
        const generated = generatePlanItems(daysCount, focusText, sources);
        onUpdatePlan([...plan, ...generated]);
        setFocusText('');
        showToast(`Составлен план на ${generated.length} дней`);
      } catch (e: any) {
        showToast(`Ошибка: ${e.message}`, true);
      } finally {
        setIsGenerating(false);
      }
    }, 600);
  };

  const autoModeText = settings.dailyEnabled
    ? `Авто-режим включён: каждый день в ${settings.dailyTime} бот готовит пост на сегодня (настройки во вкладке «Настройки»).`
    : 'Нажми «Сделать сейчас» у нужного пункта: бот подготовит фото, пост и кнопки.';

  return (
    <div>
      {plan.length === 0 ? (
        <div className="card muted">
          План пуст. Вставь план ниже или нажми «Составить план по базам».
        </div>
      ) : (
        plan.map((item) => {
          const isMade = item.status === 'made';
          const isMaking = makingId === item.id;
          const associatedPost = item.post_id ? posts.find((p) => p.id === item.post_id) : null;

          return (
            <div className="card" key={item.id} data-id={item.id}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <span
                  className={`badge ${
                    isMade ? 'published' : item.status === 'failed' ? 'failed' : isMaking ? 'making' : ''
                  }`}
                >
                  {isMaking ? 'готовлю…' : STATUS_LABELS[item.status] || 'ждёт'}
                </span>
                <span className="muted small">{item.day}</span>
              </div>

              <div style={{ fontWeight: 700, margin: '8px 0 4px', fontSize: '15px' }}>
                {item.topic}
              </div>

              {item.brief && <div className="excerpt">{item.brief}</div>}

              <div className="row" style={{ marginTop: 10, gap: 8 }}>
                <button
                  className={`b s ${isMade ? 'g' : 'w'}`}
                  disabled={isMaking}
                  onClick={() => handleMakeNow(item)}
                >
                  {isMaking ? '⏳ Пишу…' : isMade ? 'Сделать заново' : 'Сделать сейчас'}
                </button>

                {isMade && associatedPost && (
                  <button className="b s" onClick={() => onOpenDraft(associatedPost)}>
                    Посмотреть пост
                  </button>
                )}

                <button
                  className="b s d"
                  disabled={isMaking}
                  onClick={() => handleDeleteItem(item.id)}
                >
                  Убрать
                </button>
              </div>
            </div>
          );
        })
      )}

      {/* Загрузить свой план */}
      <div className="card" style={{ marginTop: 18 }}>
        <b>Загрузить свой план</b>
        <div className="muted small" style={{ margin: '4px 0 8px' }}>
          Вставь текст: по строке или абзацу на пост, с датами или без. {autoModeText}
        </div>
        <textarea
          placeholder="30.10 — Рулетка промокодов&#10;31.10 — Набор в команду продаж&#10;01.11 — Кейс Apex Core…"
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
        />
        <div style={{ height: 10 }} />
        <button
          className="b"
          style={{ width: '100%' }}
          disabled={isImporting}
          onClick={handleImportPlan}
        >
          {isImporting ? 'Разбираю…' : 'Разобрать и сохранить'}
        </button>
      </div>

      {/* Сгенерировать план по базам */}
      <div className="card">
        <b>…или сгенерировать план по базам</b>
        <div className="row" style={{ marginTop: 8 }}>
          <input
            type="number"
            min={1}
            max={31}
            value={daysCount}
            onChange={(e) => setDaysCount(Math.min(31, Math.max(1, parseInt(e.target.value, 10) || 1)))}
            style={{ width: '90px' }}
          />
          <input
            className="grow"
            placeholder="Фокус (необязательно): запуск конкурса, найм…"
            value={focusText}
            onChange={(e) => setFocusText(e.target.value)}
          />
        </div>
        <div style={{ height: 10 }} />
        <button
          className="b"
          style={{ width: '100%' }}
          disabled={isGenerating}
          onClick={handleGeneratePlan}
        >
          {isGenerating ? 'Думаю…' : 'Составить план'}
        </button>
      </div>
    </div>
  );
};
