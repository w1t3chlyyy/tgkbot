import React, { useEffect, useState } from 'react';
import { PlanItem, PostItem, Settings, SourceTable, TabType } from './types';
import { storage } from './storage';
import { PlanTab } from './components/PlanTab';
import { NewPostTab } from './components/NewPostTab';
import { QueueTab } from './components/QueueTab';
import { SettingsTab } from './components/SettingsTab';
import { DraftModal } from './components/DraftModal';

const TITLES: Record<TabType, string> = {
  plan: 'Контент-план',
  new: 'Новый пост',
  queue: 'Посты',
  settings: 'Настройки',
};

export const App: React.FC = () => {
  const [tab, setTab] = useState<TabType>('plan');
  const [settings, setSettings] = useState<Settings>(() => storage.getSettings());
  const [plan, setPlan] = useState<PlanItem[]>(() => storage.getPlan());
  const [posts, setPosts] = useState<PostItem[]>(() => storage.getPosts());
  const [sources, setSources] = useState<SourceTable[]>(() => storage.getSources());
  const [activeDraft, setActiveDraft] = useState<PostItem | null>(null);

  const [toastMessage, setToastMessage] = useState('');
  const [toastError, setToastError] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    // Telegram WebApp setup
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      try {
        tg.ready?.();
        tg.expand?.();
        tg.setHeaderColor?.('#08090c');
        tg.setBackgroundColor?.('#08090c');
      } catch {
        // ignore if not running in Telegram
      }
    }
  }, []);

  const showToast = (msg: string, isError = false) => {
    setToastMessage(msg);
    setToastError(isError);
    setToastVisible(true);
    setTimeout(() => {
      setToastVisible(false);
    }, 2800);
  };

  const handleUpdatePlan = (newPlan: PlanItem[]) => {
    setPlan(newPlan);
    storage.savePlan(newPlan);
  };

  const handleAddPost = (newPost: PostItem) => {
    const updated = [newPost, ...posts];
    setPosts(updated);
    storage.savePosts(updated);
  };

  const handleUpdatePost = (updatedPost: PostItem) => {
    const updated = posts.map((p) => (p.id === updatedPost.id ? updatedPost : p));
    setPosts(updated);
    storage.savePosts(updated);
    if (activeDraft?.id === updatedPost.id) {
      setActiveDraft(updatedPost);
    }
  };

  const handleDeletePost = (id: number) => {
    const updated = posts.filter((p) => p.id !== id);
    setPosts(updated);
    storage.savePosts(updated);
    if (activeDraft?.id === id) {
      setActiveDraft(null);
    }
    showToast('Пост удалён');
  };

  const handleSaveSettings = (newSettings: Settings) => {
    setSettings(newSettings);
    storage.saveSettings(newSettings);
  };

  const handlePublishPost = (post: PostItem) => {
    const updated: PostItem = {
      ...post,
      status: 'published',
      channel_link: `https://t.me/${(settings.channel || 'hustlify').replace('@', '')}/${Math.floor(
        Math.random() * 800 + 100
      )}`,
    };
    handleUpdatePost(updated);
    showToast('Пост опубликован');
  };

  return (
    <>
      <header>
        <div className="logo">
          <b>HUSTLI</b>FY
        </div>
        <div id="title">{TITLES[tab]}</div>
      </header>

      <main id="view">
        {tab === 'plan' && (
          <PlanTab
            plan={plan}
            settings={settings}
            sources={sources}
            onUpdatePlan={handleUpdatePlan}
            onAddPost={handleAddPost}
            onOpenDraft={(p) => setActiveDraft(p)}
            showToast={showToast}
            posts={posts}
          />
        )}

        {tab === 'new' && (
          <NewPostTab
            settings={settings}
            sources={sources}
            onAddPost={handleAddPost}
            onOpenDraft={(p) => setActiveDraft(p)}
            showToast={showToast}
          />
        )}

        {tab === 'queue' && (
          <QueueTab
            posts={posts}
            settings={settings}
            onOpenDraft={(p) => setActiveDraft(p)}
            onUpdatePost={handleUpdatePost}
            onDeletePost={handleDeletePost}
            showToast={showToast}
          />
        )}

        {tab === 'settings' && (
          <SettingsTab
            settings={settings}
            onSave={handleSaveSettings}
            showToast={showToast}
          />
        )}
      </main>

      <nav id="tabs">
        <button
          className={tab === 'plan' ? 'on' : ''}
          onClick={() => setTab('plan')}
        >
          План
        </button>
        <button
          className={tab === 'new' ? 'on' : ''}
          onClick={() => setTab('new')}
        >
          Новый пост
        </button>
        <button
          className={tab === 'queue' ? 'on' : ''}
          onClick={() => setTab('queue')}
        >
          Посты {posts.length > 0 && `(${posts.length})`}
        </button>
        <button
          className={tab === 'settings' ? 'on' : ''}
          onClick={() => setTab('settings')}
        >
          Настройки
        </button>
      </nav>

      {/* Toast Notification */}
      <div id="toast" className={`${toastVisible ? 'show' : ''} ${toastError ? 'err' : ''}`}>
        {toastMessage}
      </div>

      {/* Post draft and inspector modal */}
      {activeDraft && (
        <DraftModal
          post={activeDraft}
          settings={settings}
          onClose={() => setActiveDraft(null)}
          onUpdate={handleUpdatePost}
          onPublish={handlePublishPost}
          showToast={showToast}
        />
      )}
    </>
  );
};
export default App;
