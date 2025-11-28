import { PomodoroTimer } from './Timer';
import Chrome from '../Chrome';
import { createPomodoroMenu } from './Menu';
import { History } from './History';
import StorageManager from './StorageManager';
import { SettingsSchema, PersistentSettings } from './Settings';
import { HistoryService, SoundsService, SettingsService, PomodoroService, OptionsService } from './Services';
import { BadgeObserver, TimerSoundObserver, ExpirationSoundObserver, NotificationObserver, HistoryObserver, ApiSyncObserver, CountdownObserver, MenuObserver } from './Observers';
import { ServiceBroker } from '../Service';
import * as Alarms from './Alarms';

async function run() {
  try {
    chrome.runtime.onUpdateAvailable.addListener(() => {
      // We must listen to (but do nothing with) the onUpdateAvailable event in order to
      // defer updating the extension until the next time Chrome is restarted. We do not want
      // the extension to automatically reload on update since a Pomodoro might be running.
      // See https://developer.chrome.com/apps/runtime#event-onUpdateAvailable.
    });

    let settingsManager = new StorageManager(new SettingsSchema(), Chrome.storage.sync);
    let settings = await PersistentSettings.create(settingsManager);
    let timer = new PomodoroTimer(settings);
    let history = new History();

    let menu = createPomodoroMenu(timer);
    timer.observe(new HistoryObserver(history));
    timer.observe(new BadgeObserver());
    timer.observe(new NotificationObserver(timer, settings, history));
    timer.observe(new ExpirationSoundObserver(settings));
    timer.observe(new TimerSoundObserver(settings));
    timer.observe(new CountdownObserver(settings));
    timer.observe(new MenuObserver(menu));

    // API sync for daily-progress integration
    let apiSync = new ApiSyncObserver();
    await apiSync.initialize();
    timer.observe(apiSync);

    // Handle messages from options page and expire page
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'retrySyncQueue') {
        apiSync.processQueue().then(() => {
          sendResponse({ success: true });
        });
        return true; // Keep channel open for async response
      }

      if (message.action === 'completePomodoroWithTask') {
        console.log('[Background] Received completePomodoroWithTask message. Task:', message.taskText);
        apiSync.completePomodoroWithTask(message.taskText).then(() => {
          console.log('[Background] Pomodoro completion successful');
          sendResponse({ success: true });
        }).catch((error) => {
          console.error('[Background] Error completing pomodoro:', error);
          sendResponse({ success: false, error: error.message });
        });
        return true; // Keep channel open for async response
      }
    });

    menu.apply();
    settingsManager.on('change', () => menu.apply());

    Alarms.install(timer, settingsManager);
    chrome.browserAction.onClicked.addListener(() => {
      if (timer.isRunning) {
        timer.pause();
      } else if (timer.isPaused) {
        timer.resume();
      } else {
        timer.start();
      }
    });

    ServiceBroker.register(new HistoryService(history));
    ServiceBroker.register(new SoundsService());
    ServiceBroker.register(new SettingsService(settingsManager));
    ServiceBroker.register(new PomodoroService(timer));
    ServiceBroker.register(new OptionsService());

    console.log('Marinara background script initialized successfully');
  } catch (error) {
    console.error('Failed to initialize Marinara background script:', error);

    // Show error notification to user
    chrome.notifications.create({
      type: 'basic',
      title: 'Marinara: Initialization Error',
      message: 'Failed to initialize extension. Check browser console for details.',
      iconUrl: 'images/128.png',
      requireInteraction: true
    });

    // Re-throw to ensure error is visible in background page console
    throw error;
  }
}

run();