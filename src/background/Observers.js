import M from '../Messages';
import { Phase } from './Timer';
import { pomodoroCount } from '../Filters';
import * as Sounds from '../Sounds';
import Notification from './Notification';
import { ExpirationPage } from './Expiration';
import Mutex from '../Mutex';
import createTimerSound from '../TimerSound';
import { SingletonPage, PageHost } from './SingletonPage';

class BadgeObserver
{
  onStart({ phase, remaining }) {
    this.updateBadge({ phase, minutes: Math.round(remaining / 60) });
  }

  onTick({ phase, remaining }) {
    this.updateBadge({ phase, minutes: Math.round(remaining / 60) });
  }

  onStop() {
    this.removeBadge();
  }

  onPause({ phase }) {
    this.updateBadge({ phase, text: '—', tooltip: M.timer_paused });
  }

  onResume({ phase, remaining }) {
    this.updateBadge({ phase, minutes: Math.round(remaining / 60) });
  }

  onExpire() {
    this.removeBadge();
  }

  updateBadge({ phase, minutes, tooltip, text }) {
    let title = {
      [Phase.Focus]: M.focus,
      [Phase.ShortBreak]: M.short_break,
      [Phase.LongBreak]: M.long_break
    }[phase];

    if (minutes != null) {
      text = minutes < 1 ? M.less_than_minute : M.n_minutes(minutes);
      tooltip = M.browser_action_tooltip(title, M.time_remaining(text));
    } else {
      tooltip = M.browser_action_tooltip(title, tooltip);
    }

    let color = phase === Phase.Focus ? '#bb0000' : '#11aa11';
    chrome.browserAction.setTitle({ title: tooltip });
    chrome.browserAction.setBadgeText({ text });
    chrome.browserAction.setBadgeBackgroundColor({ color });
  }

  removeBadge() {
    chrome.browserAction.setTitle({ title: '' });
    chrome.browserAction.setBadgeText({ text: '' });
  }
}

class TimerSoundObserver
{
  constructor(settings) {
    this.settings = settings;
    this.mutex = new Mutex();
    this.timerSound = null;
  }

  async onStart({ phase }) {
    let timerSoundSettings = this.settings.focus.timerSound;
    await this.mutex.exclusive(async () => {
      // Cleanup any existing timer sound.
      this.timerSound && await this.timerSound.close();

      if (phase === Phase.Focus && timerSoundSettings) {
        this.timerSound = await createTimerSound(timerSoundSettings);
        this.timerSound.start();
      } else {
        this.timerSound = null;
      }
    });
  }

  async onStop() {
    await this.mutex.exclusive(async () => {
      this.timerSound && await this.timerSound.close();
    });
  }

  async onPause() {
    await this.mutex.exclusive(async () => {
      this.timerSound && await this.timerSound.stop();
    });
  }

  async onResume() {
    await this.mutex.exclusive(async () => {
      this.timerSound && await this.timerSound.start();
    });
  }

  async onExpire() {
    await this.mutex.exclusive(async () => {
      this.timerSound && await this.timerSound.close();
    });
  }
}

class ExpirationSoundObserver
{
  constructor(settings) {
    this.settings = settings;
  }

  onExpire({ phase }) {
    let sound = s => s && s.notifications.sound;
    let filename = {
      [Phase.Focus]: sound(this.settings.focus),
      [Phase.ShortBreak]: sound(this.settings.shortBreak),
      [Phase.LongBreak]: sound(this.settings.longBreak)
    }[phase];

    if (filename) {
      Sounds.play(filename);
    }
  }
}

class NotificationObserver
{
  constructor(timer, settings, history) {
    this.timer = timer;
    this.settings = settings;
    this.history = history;
    this.notification = null;
    this.expiration = null;
    this.mutex = new Mutex();
  }

  onStart() {
    this.mutex.exclusive(async () => {
      if (this.notification) {
        this.notification.close();
        this.notification = null;
      }

      if (this.expiration) {
        this.expiration.close();
        this.expiration = null;
      }
    });
  }

  async onExpire({ phase, nextPhase }) {
    let settings = this.settings[{
      [Phase.Focus]: 'focus',
      [Phase.ShortBreak]: 'shortBreak',
      [Phase.LongBreak]: 'longBreak'
    }[phase]];

    let hasLongBreak = this.timer.hasLongBreak;
    let title = {
      [Phase.Focus]: M.start_focusing,
      [Phase.ShortBreak]: hasLongBreak ? M.take_a_short_break : M.take_a_break,
      [Phase.LongBreak]: M.take_a_long_break
    }[nextPhase];

    let buttonText = {
      [Phase.Focus]: M.start_focusing_now,
      [Phase.ShortBreak]: hasLongBreak ? M.start_short_break_now : M.start_break_now,
      [Phase.LongBreak]: M.start_long_break_now
    }[nextPhase];

    let action = {
      [Phase.Focus]: M.start_focusing,
      [Phase.ShortBreak]: hasLongBreak ? M.start_short_break : M.start_break,
      [Phase.LongBreak]: M.start_long_break
    }[nextPhase];

    let messages = [];
    let remaining = this.timer.pomodorosUntilLongBreak;
    if (remaining > 0) {
      messages.push(M.pomodoros_until_long_break(pomodoroCount(remaining)));
    }

    let pomodorosToday = await this.history.countToday();
    messages.push(M.pomodoros_completed_today(pomodoroCount(pomodorosToday)));

    messages = messages.filter(m => !!m);

    await this.mutex.exclusive(async () => {
      if (settings.notifications.desktop) {
        this.notification = new Notification(title, messages.join('\n'), () => this.timer.start());
        this.notification.addButton(buttonText, () => this.timer.start());
        await this.notification.show();
      }

      if (settings.notifications.tab) {
        let phaseId = {
          [Phase.Focus]: 'focus',
          [Phase.ShortBreak]: hasLongBreak ? 'short-break' : 'break',
          [Phase.LongBreak]: 'long-break'
        }[nextPhase];

        this.expiration = await ExpirationPage.show(
          title,
          messages,
          action,
          pomodorosToday,
          phaseId
        );
      }
    });
  }
}

class HistoryObserver
{
  constructor(history) {
    this.history = history;
  }

  async onExpire({ phase, duration }) {
    if (phase !== Phase.Focus) {
      return;
    }

    await this.history.addPomodoro(duration);
  }
}

class ApiSyncObserver
{
  constructor() {
    this.startedAt = null;
    this.syncQueue = [];
    this.isSyncing = false;
    this.pendingPomodoro = null; // Store pending pomodoro until task is entered
  }

  onStart({ phase }) {
    if (phase === Phase.Focus) {
      this.startedAt = new Date().toISOString();
    }
  }

  async onExpire({ phase, duration }) {
    if (phase !== Phase.Focus) {
      return;
    }

    // Store pending pomodoro data - don't sync yet, wait for task input
    const endedAt = new Date().toISOString();
    this.pendingPomodoro = {
      started_at: this.startedAt || new Date(Date.now() - duration * 1000).toISOString(),
      ended_at: endedAt,
      duration_seconds: duration
    };

    console.log('Focus session completed. Waiting for task input before syncing.');
  }

  async completePomodoroWithTask(taskText) {
    if (!this.pendingPomodoro) {
      console.warn('No pending pomodoro to complete');
      return;
    }

    const { savedTags } = await this.getTaskAndTags();

    // Extract tags from text
    const extractedTags = [];
    if (taskText) {
      const hashtagMatches = taskText.match(/#(\w+)/g);
      if (hashtagMatches) {
        hashtagMatches.forEach(tag => {
          const tagName = tag.slice(1); // Remove #
          if (!extractedTags.includes(tagName)) {
            extractedTags.push(tagName);
          }
        });
      }
    }

    // Create complete pomodoro object with task
    const pomodoro = {
      ...this.pendingPomodoro,
      text: taskText || null,
      tags: extractedTags
    };

    // Add to queue and attempt sync
    this.syncQueue.push(pomodoro);
    await this.saveQueue();
    await this.processQueue();

    // Save any new tags to savedTags for autocomplete
    if (extractedTags.length > 0) {
      await this.saveNewTags(extractedTags, savedTags);
    }

    // Clear pending pomodoro
    this.pendingPomodoro = null;

    console.log('Pomodoro completed with task and queued for sync:', pomodoro);
  }

  async getTaskAndTags() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['currentTask', 'savedTags'], (result) => {
        resolve({
          currentTask: result.currentTask || '',
          savedTags: result.savedTags || []
        });
      });
    });
  }

  async saveNewTags(extractedTags, existingSavedTags) {
    const newTags = extractedTags.filter(tag => !existingSavedTags.includes(tag));
    if (newTags.length > 0) {
      const updatedTags = [...existingSavedTags, ...newTags];
      await new Promise((resolve) => {
        chrome.storage.local.set({ savedTags: updatedTags }, resolve);
      });
    }
  }

  async saveQueue() {
    try {
      await new Promise((resolve, reject) => {
        chrome.storage.local.set({ syncQueue: this.syncQueue }, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve();
          }
        });
      });
    } catch (e) {
      console.error('Failed to save sync queue:', e);
    }
  }

  async loadQueue() {
    try {
      const result = await new Promise((resolve) => {
        chrome.storage.local.get(['syncQueue'], resolve);
      });
      this.syncQueue = result.syncQueue || [];
    } catch (e) {
      console.error('Failed to load sync queue:', e);
      this.syncQueue = [];
    }
  }

  async getApiSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['apiEndpoint', 'apiKey'], (result) => {
        resolve({
          endpoint: result.apiEndpoint || '',
          key: result.apiKey || ''
        });
      });
    });
  }

  async processQueue() {
    if (this.isSyncing || this.syncQueue.length === 0) {
      return;
    }

    const { endpoint, key } = await this.getApiSettings();
    if (!endpoint || !key) {
      console.log('API not configured, pomodoro queued for later sync');
      return;
    }

    this.isSyncing = true;

    while (this.syncQueue.length > 0) {
      const pomodoro = this.syncQueue[0];

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': key
          },
          body: JSON.stringify(pomodoro)
        });

        if (response.ok) {
          this.syncQueue.shift(); // Remove from queue on success
          await this.saveQueue();
          console.log('Pomodoro synced successfully');
        } else {
          console.error('API error:', response.status);
          break; // Stop processing on error, retry later
        }
      } catch (e) {
        console.error('Network error syncing pomodoro:', e);
        break; // Stop processing, retry later
      }
    }

    this.isSyncing = false;
  }

  async initialize() {
    await this.loadQueue();
    // Try to sync any queued pomodoros on startup
    await this.processQueue();
  }
}

class CountdownObserver
{
  constructor(settings) {
    this.settings = settings;
  }

  async onStart({ phase }) {
    let settings = this.settings[{
      [Phase.Focus]: 'focus',
      [Phase.ShortBreak]: 'shortBreak',
      [Phase.LongBreak]: 'longBreak'
    }[phase]];

    let { host, resolution } = settings.countdown;
    if (!host) {
      return;
    }

    let page = null;
    let url = chrome.extension.getURL('modules/countdown.html');

    if (host === 'tab') {
      page = await SingletonPage.show(url, PageHost.Tab);
      page.focus();
      return;
    }

    if (host !== 'window') {
      return;
    }

    let properties = {};
    if (resolution === 'fullscreen') {
      properties = { state: 'maximized' };
    } else if (Array.isArray(resolution)) {
      let [windowWidth, windowHeight] = resolution;
      const { width: screenWidth, height: screenHeight } = window.screen;
      let left = screenWidth / 2 - windowWidth / 2;
      let top = screenHeight / 2 - windowHeight / 2;
      properties = { width: windowWidth, height: windowHeight, left, top };
    }

    page = await SingletonPage.show(url, PageHost.Window, properties);
    page.focus();
  }
}

class MenuObserver
{
  constructor(menu) {
    this.menu = menu;
  }

  onStart() {
    this.menu.apply();
  }

  onStop() {
    this.menu.apply();
  }

  onPause() {
    this.menu.apply();
  }

  onResume() {
    this.menu.apply();
  }

  onTick() {
    this.menu.apply();
  }

  onExpire() {
    this.menu.apply();
  }
}

class TraceObserver
{
  onStart(...args) {
    console.log('start', ...args);
  }

  onStop(...args) {
    console.log('stop', ...args);
  }

  onPause(...args) {
    console.log('pause', ...args);
  }

  onResume(...args) {
    console.log('resume', ...args);
  }

  onTick(...args) {
    console.log('tick', ...args);
  }

  onExpire(...args) {
    console.log('expire', ...args);
  }
}

export {
  BadgeObserver,
  TimerSoundObserver,
  ExpirationSoundObserver,
  NotificationObserver,
  HistoryObserver,
  ApiSyncObserver,
  CountdownObserver,
  MenuObserver,
  TraceObserver
};