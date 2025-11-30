<template>
  <div>
    <div class="countdown">
      <Timer
        :class="timerClass"
        :state="state"
        :duration="duration"
        :elapsed="elapsed"
        :enabled="hasTime"
        @pause="onPause"
        @resume="onResume"
        @restart="onRestart">
      </Timer>
    </div>
    <div class="task-input-container" v-if="phase === Phase.Focus">
      <input
        type="text"
        v-model="currentTask"
        @input="saveCurrentTask"
        placeholder="What are you working on? #tags"
        class="task-input"
        ref="taskInput">
      <div class="tag-suggestions" v-if="showSuggestions && filteredTags.length">
        <div
          v-for="tag in filteredTags"
          :key="tag"
          @click="selectTag(tag)"
          class="tag-suggestion">
          #{{ tag }}
        </div>
      </div>
    </div>
    <button @click="showSettings" class="settings nav" :title="M.settings">
      <Sprite src="/images/settings.svg"></Sprite>
      <span>{{ M.settings }}</span>
    </button>
    <button @click="showHistory" class="history nav" :title="M.view_history">
      <span>{{ M.view_history }}</span>
      <Sprite src="/images/history.svg"></Sprite>
    </button>
  </div>
</template>

<style lang="scss">
@import '../fonts.css';

body {
  margin: 0;
  padding: 0;
}
.countdown {
  display: flex;
  height: 100vh;
  max-width: 100vw;
  justify-content: center;
  align-items: center;
  .timer {
    height: 90%;
    width: 90%;
  }
  .timer svg path.elapsed {
    stroke: #42d;
  }
  .timer.focus svg path.elapsed {
    stroke: #d42;
  }
  .timer.break svg path.elapsed {
    stroke: #5a4;
  }
}
button.nav {
  flex: 0 0 150px;
  outline: 0 !important;
  background: transparent;
  font-size: 18px;
  cursor: pointer;
  color: #555;
  border: 0;
  text-decoration: none;
  position: absolute;
  display: none;
  align-items: center;
  &:hover {
    color: #a00;
  }
  span {
    display: none;
  }
  svg {
    width: 28px;
    height: 28px;
  }
  @media (min-width: 250px) {
    display: flex;
  }
  @media (min-width: 600px) {
    span {
      display: inherit;
    }
  }
}
.settings {
  left: 10px;
  bottom: 10px;
  @media (min-width: 400px) {
    left: 20px;
    bottom: 20px;
  }
  svg {
    margin-right: 10px;
  }
}
.history {
  right: 10px;
  bottom: 10px;
  @media (min-width: 400px) {
    right: 20px;
    bottom: 20px;
  }
  svg {
    margin-left: 10px;
  }
}
.task-input-container {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  width: 90%;
  max-width: 500px;
  z-index: 100;
}
.task-input {
  width: 100%;
  padding: 12px 16px;
  font-size: 16px;
  border: 2px solid #ddd;
  border-radius: 8px;
  outline: none;
  box-sizing: border-box;
  background: rgba(255, 255, 255, 0.95);
  &:focus {
    border-color: #4a90d9;
  }
  &::placeholder {
    color: #999;
  }
}
.tag-suggestions {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  background: white;
  border: 1px solid #ddd;
  border-top: none;
  border-radius: 0 0 8px 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  max-height: 200px;
  overflow-y: auto;
}
.tag-suggestion {
  padding: 10px 16px;
  cursor: pointer;
  color: #4a90d9;
  &:hover {
    background: #f5f5f5;
  }
}
</style>

<script>
import TimerStats from './TimerStats';
import Timer from './Timer';
import Sprite from '../Sprite';
import { TimerState, Phase } from '../background/Timer';
import { OptionsClient, SettingsClient, PomodoroClient } from '../background/Services';
import { mmss } from '../Filters';
import M from '../Messages';

export default {
  mixins: [TimerStats],
  data() {
    return {
      currentTask: '',
      savedTags: [],
      showSuggestions: false,
      Phase: Phase
    };
  },
  created() {
    document.title = `${M.countdown} - ${M.app_name_short}`;
    document.addEventListener('keydown', this.onKeyDown);
    this.loadCurrentTask();
    this.loadSavedTags();
  },
  beforeDestroy() {
    document.removeEventListener('keydown', this.onKeyDown);
  },
  methods: {
    loadCurrentTask() {
      chrome.storage.local.get(['currentTask'], (result) => {
        this.currentTask = result.currentTask || '';
      });
    },
    loadSavedTags() {
      chrome.storage.local.get(['savedTags'], (result) => {
        this.savedTags = result.savedTags || [];
      });
    },
    saveCurrentTask() {
      chrome.storage.local.set({ currentTask: this.currentTask });
      // Check if we should show tag suggestions
      this.checkForTagTrigger();
    },
    checkForTagTrigger() {
      const cursorPos = this.$refs.taskInput?.selectionStart || 0;
      const textBeforeCursor = this.currentTask.slice(0, cursorPos);
      const hashMatch = textBeforeCursor.match(/#(\w*)$/);
      this.showSuggestions = !!hashMatch;
    },
    selectTag(tag) {
      const cursorPos = this.$refs.taskInput?.selectionStart || this.currentTask.length;
      const textBeforeCursor = this.currentTask.slice(0, cursorPos);
      const textAfterCursor = this.currentTask.slice(cursorPos);
      const newTextBefore = textBeforeCursor.replace(/#(\w*)$/, `#${tag} `);
      this.currentTask = newTextBefore + textAfterCursor;
      this.showSuggestions = false;
      this.saveCurrentTask();
      this.$refs.taskInput?.focus();
    },
    showSettings() {
      OptionsClient.once.showPage('settings');
    },
    showHistory() {
      OptionsClient.once.showPage('history');
    },
    onKeyDown(e) {
      if (e.key != ' ') {
        return;
      }

      if (this.state == TimerState.Running) {
        PomodoroClient.once.pause();
      } else if (this.state == TimerState.Paused) {
        PomodoroClient.once.resume();
      }
    },
    onPause() {
      PomodoroClient.once.pause();
    },
    onResume() {
      PomodoroClient.once.resume();
    },
    onRestart() {
      PomodoroClient.once.restart();
    }
  },
  computed: {
    filteredTags() {
      if (!this.showSuggestions) return [];
      const cursorPos = this.$refs.taskInput?.selectionStart || 0;
      const textBeforeCursor = this.currentTask.slice(0, cursorPos);
      const hashMatch = textBeforeCursor.match(/#(\w*)$/);
      if (!hashMatch) return [];
      const partial = hashMatch[1].toLowerCase();
      return this.savedTags.filter(tag =>
        tag.toLowerCase().startsWith(partial) && tag.toLowerCase() !== partial
      ).slice(0, 5);
    },
    timerClass() {
      return {
        null: '',
        [Phase.Focus]: 'focus',
        [Phase.ShortBreak]: 'break',
        [Phase.LongBreak]: 'break'
      }[this.phase];
    },
    title() {
      let phase = M.countdown;
      let remaining = '';
      if (this.checkpointStartAt) {
        phase = {
          null: M.countdown,
          [Phase.Focus]: M.focus,
          [Phase.ShortBreak]: M.short_break,
          [Phase.LongBreak]: M.long_break
        }[this.phase];

        remaining = `[${mmss(this.remainingSeconds)}] `;
      }

      return `${remaining}${phase} - ${M.app_name_short}`;
    }
  },
  watch: {
    async state(to) {
      if (to != TimerState.Stopped) {
        return;
      }

      let settings = await SettingsClient.once.getSettings();
      let { countdown } = settings[{
        [Phase.Focus]: 'focus',
        [Phase.ShortBreak]: 'shortBreak',
        [Phase.LongBreak]: 'longBreak'
      }[this.phase]];

      if (countdown.autoclose) {
        window.close();
      }
    },
    title(to) {
      document.title = to;
    }
  },
  components: {
    Timer,
    Sprite
  }
};
</script>