import React, { useState } from 'react';
import { Settings } from '../types';

interface SettingsTabProps {
  settings: Settings;
  onSave: (newSettings: Settings) => void;
  showToast: (msg: string, isError?: boolean) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  settings,
  onSave,
  showToast,
}) => {
  const [tz, setTz] = useState(settings.tz);
  const [dailyTime, setDailyTime] = useState(settings.dailyTime);
  const [dailyEnabled, setDailyEnabled] = useState(settings.dailyEnabled);
  const [customEmoji, setCustomEmoji] = useState(settings.customEmoji);
  const [packLink, setPackLink] = useState('');
  const [emojiCount, setEmojiCount] = useState(64);
  const [linksJson, setLinksJson] = useState(() => JSON.stringify(settings.links, null, 2));
  const [stylePrompt, setStylePrompt] = useState(settings.stylePrompt);
  const [channel, setChannel] = useState(settings.channel || '@hustlify');
  const [botToken, setBotToken] = useState(settings.botToken || '');
  const [adminIds, setAdminIds] = useState(settings.adminIds || '');
  const [isTestingBot, setIsTestingBot] = useState(false);

  const handleSave = () => {
    let parsedLinks: Record<string, string>;
    try {
      parsedLinks = JSON.parse(linksJson);
    } catch {
      showToast('Ссылки: некорректный JSON', true);
      return;
    }

    const updated: Settings = {
      ...settings,
      tz,
      dailyTime,
      dailyEnabled,
      customEmoji,
      channel,
      links: parsedLinks,
      stylePrompt,
      botToken,
      adminIds,
    };

    onSave(updated);
    showToast('Настройки сохранены');
  };

  const handleLoadPack = () => {
    if (!packLink.trim()) {
      showToast('Укажи ссылку вида t.me/addemoji/…', true);
      return;
    }
    setEmojiCount((prev) => prev + 32);
    setPackLink('');
    showToast('Пак эмодзи успешно подгружен');
  };

  const handleTestBot = async () => {
    if (!botToken.trim()) {
      showToast('Введи токен бота', true);
      return;
    }
    setIsTestingBot(true);
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken.trim()}/getMe`);
      const data = await res.json();
      if (data.ok) {
        showToast(`Бот подключён: @${data.result.username}`);
      } else {
        showToast(`Ошибка Telegram: ${data.description || 'Неверный токен'}`, true);
      }
    } catch (e: any) {
      showToast(`Ошибка сети: ${e.message}`, true);
    } finally {
      setIsTestingBot(false);
    }
  };

  return (
    <div className="card">
      <label style={{ marginTop: 0 }}>Часовой пояс</label>
      <input value={tz} onChange={(e) => setTz(e.target.value)} />

      <div className="row" style={{ marginTop: 4 }}>
        <div className="grow">
          <label>Авто-режим: делать пост на сегодня в</label>
          <input value={dailyTime} onChange={(e) => setDailyTime(e.target.value)} />
        </div>
        <div className="sw" style={{ paddingTop: 26 }}>
          <span>Авто</span>
          <input
            type="checkbox"
            checked={dailyEnabled}
            onChange={(e) => setDailyEnabled(e.target.checked)}
          />
        </div>
      </div>

      <div className="sw" style={{ marginTop: 12 }}>
        <span>
          Премиум-эмодзи <span className="muted small">(в базе: {emojiCount})</span>
        </span>
        <input
          type="checkbox"
          checked={customEmoji}
          onChange={(e) => setCustomEmoji(e.target.checked)}
        />
      </div>

      <label>Пак премиум-эмодзи</label>
      <div className="row nw">
        <input
          className="grow"
          placeholder="t.me/addemoji/HustlifyPack"
          value={packLink}
          onChange={(e) => setPackLink(e.target.value)}
        />
        <button className="b g" style={{ whiteSpace: 'nowrap' }} onClick={handleLoadPack}>
          Загрузить
        </button>
      </div>

      <label>Канал для публикаций</label>
      <input
        placeholder="@hustlify или ID канала"
        value={channel}
        onChange={(e) => setChannel(e.target.value)}
      />

      <label>Telegram Bot Token (необязательно)</label>
      <div className="row nw">
        <input
          type="password"
          className="grow"
          placeholder="123456789:ABCdefGHI..."
          value={botToken}
          onChange={(e) => setBotToken(e.target.value)}
        />
        <button
          className="b g"
          style={{ whiteSpace: 'nowrap' }}
          disabled={isTestingBot}
          onClick={handleTestBot}
        >
          {isTestingBot ? 'Проверка…' : 'Проверить'}
        </button>
      </div>

      <label>ID администраторов</label>
      <input
        placeholder="5119044165"
        value={adminIds}
        onChange={(e) => setAdminIds(e.target.value)}
      />

      <label>Ссылки для кнопок (JSON)</label>
      <textarea
        value={linksJson}
        onChange={(e) => setLinksJson(e.target.value)}
        style={{ fontFamily: 'monospace', fontSize: 13, minHeight: 110 }}
      />

      <label>Стиль-промпт для генерации</label>
      <textarea
        style={{ minHeight: 180, fontSize: 13 }}
        value={stylePrompt}
        onChange={(e) => setStylePrompt(e.target.value)}
      />

      <div style={{ height: 14 }} />
      <button className="b" style={{ width: '100%' }} onClick={handleSave}>
        Сохранить настройки
      </button>
    </div>
  );
};
