<template>
  <div class="dialog" v-if="show">
    <h1>{{ title }}</h1>
    <div><p>{{ message }}</p></div>

    <!-- Task input form - only show after focus sessions complete (before taking a break) -->
    <div v-if="isFocusSession" class="task-section">
      <div class="task-header">
        <h3>{{ M.what_did_you_work_on || 'What did you work on?' }}</h3>
      </div>

      <!-- Recent pomodoros section -->
      <div v-if="recentPomodoros.length > 0" class="recent-pomodoros">
        <div class="section-label">Recent Sessions:</div>
        <div class="pomodoro-list">
          <div
            v-for="(pomo, index) in recentPomodoros"
            :key="index"
            class="pomodoro-item"
          >
            <div class="pomodoro-time">
              {{ formatDateTime(pomo.ended_at) }} ({{ formatDuration(pomo.duration_seconds) }})
            </div>
            <div v-if="pomo.text" class="pomodoro-text">{{ pomo.text }}</div>
            <div v-if="pomo.tags && pomo.tags.length > 0" class="pomodoro-tags">
              <span v-for="tag in pomo.tags" :key="tag" class="tag-badge">#{{ tag }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- All tags section -->
      <div v-if="getAllTags().length > 0" class="all-tags-section">
        <div class="section-label">All Tags from Recent Sessions:</div>
        <div class="all-tags-list">
          <span v-for="tag in getAllTags()" :key="tag" class="tag-chip">#{{ tag }}</span>
        </div>
      </div>

      <div class="task-input-wrapper">
        <textarea
          v-model="currentTask"
          @keydown.enter.ctrl="saveAndStartSession"
          :placeholder="M.task_placeholder || 'e.g., Fixed login bug #bugfix #auth'"
          class="task-input"
          ref="taskInput"
          rows="3"
        ></textarea>
        <div class="task-hint">{{ M.task_hint || 'Use #hashtags to categorize your work. Press Ctrl+Enter to continue.' }}</div>
      </div>

      <!-- Tag suggestions -->
      <div v-if="savedTags.length > 0" class="tag-suggestions">
        <div class="tag-label">{{ M.quick_tags || 'Quick tags:' }}</div>
        <div class="tag-buttons">
          <button
            v-for="tag in savedTags"
            :key="tag"
            @click="toggleTag(tag)"
            class="tag-button"
            :class="{ active: isTagInTask(tag) }"
          >
            #{{ tag }}
          </button>
        </div>
      </div>

      <div class="action-buttons">
        <button @click.prevent="skipAndStartSession" class="button skip-button">
          {{ M.skip || 'Skip' }}
        </button>
        <button @click.prevent="saveAndStartSession" class="button start-session" :class="phase">
          {{ action }}
        </button>
      </div>
    </div>

    <!-- Simple start button for when breaks complete (starting next focus session) -->
    <div v-else>
      <button @click.prevent="startSession" class="button start-session" :class="phase">
        {{ action }}
      </button>
    </div>

    <div class="pomodoros-today">
      <p class="pomodoros">
        <i v-for="_ of new Array(pomodoroCount)" :key="_" class="icon-circle"></i>
      </p>
      <p>{{ M.completed_today }}</p>
      <button @click.prevent="showHistoryPage" class="view-history">{{ M.view_history }}</button>
    </div>
  </div>
</template>

<style lang="scss">
@import '../fontello.css';
@import '../fonts.css';

body, html, button {
  font-family: 'Source Sans Pro', sans-serif;
}
body, html {
  height: 100%;
  padding: 0;
  margin: 0;
}
body {
  background: #fff;
}
.dialog {
  position: relative;
  padding: 50px 0px;
  background: #fff;
  top: 5%;
  text-align: center;
  h1 {
    margin: 0 auto 15px auto;
    padding-bottom: 15px;
    border-bottom: 1px solid #ddd;
    font-weight: normal;
    font-size: 32px;
    width: 600px;
    max-width: 90%;
  }
  > div > p {
    color: #222;
    font-size: 18px;
    margin: 0 0 30px 0;
  }
  .pomodoros-today p {
    margin-bottom: 15px;
  }
}

// Task Section
.task-section {
  margin: 30px auto;
  width: 600px;
  max-width: 90%;

  .task-header {
    margin-bottom: 20px;

    h3 {
      font-size: 20px;
      font-weight: 600;
      color: #333;
      margin: 0;
    }
  }

  .section-label {
    font-size: 14px;
    font-weight: 600;
    color: #555;
    margin-bottom: 12px;
    text-align: left;
  }

  .recent-pomodoros {
    margin-bottom: 25px;
    background: #f8f9fa;
    border-radius: 8px;
    padding: 15px;
    max-height: 300px;
    overflow-y: auto;

    .pomodoro-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .pomodoro-item {
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      padding: 12px;
      text-align: left;

      .pomodoro-time {
        font-size: 12px;
        color: #888;
        margin-bottom: 6px;
      }

      .pomodoro-text {
        font-size: 14px;
        color: #333;
        margin-bottom: 8px;
        word-wrap: break-word;
      }

      .pomodoro-tags {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;

        .tag-badge {
          display: inline-block;
          padding: 3px 10px;
          font-size: 12px;
          background: #e3f2fd;
          color: #0277bd;
          border-radius: 12px;
          font-weight: 500;
        }
      }
    }
  }

  .all-tags-section {
    margin-bottom: 25px;
    background: #fff9e6;
    border-radius: 8px;
    padding: 15px;

    .all-tags-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: flex-start;

      .tag-chip {
        display: inline-block;
        padding: 6px 14px;
        font-size: 13px;
        background: #fff;
        color: #f57c00;
        border: 1.5px solid #f57c00;
        border-radius: 16px;
        font-weight: 500;
      }
    }
  }

  .task-input-wrapper {
    margin-bottom: 20px;

    .task-input {
      width: 100%;
      padding: 15px;
      font-size: 16px;
      font-family: 'Source Sans Pro', sans-serif;
      border: 2px solid #ddd;
      border-radius: 8px;
      resize: vertical;
      transition: border-color 0.2s;
      box-sizing: border-box;

      &:focus {
        outline: none;
        border-color: #0aef;
      }

      &::placeholder {
        color: #999;
      }
    }

    .task-hint {
      margin-top: 8px;
      font-size: 13px;
      color: #666;
      text-align: left;
    }
  }

  .tag-suggestions {
    margin-bottom: 25px;

    .tag-label {
      font-size: 14px;
      font-weight: 600;
      color: #555;
      margin-bottom: 10px;
      text-align: left;
    }

    .tag-buttons {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: flex-start;

      .tag-button {
        padding: 6px 14px;
        font-size: 14px;
        border: 1.5px solid #0ae;
        background: #fff;
        color: #0ae;
        border-radius: 20px;
        cursor: pointer;
        transition: all 0.2s;
        outline: none;

        &:hover {
          background: #e8f7ff;
          transform: translateY(-1px);
        }

        &.active {
          background: #0ae;
          color: #fff;
          box-shadow: 0 2px 4px rgba(0, 170, 238, 0.3);
        }

        &:active {
          transform: translateY(0);
        }
      }
    }
  }

  .action-buttons {
    display: flex;
    gap: 15px;
    justify-content: center;
    align-items: center;
    margin-top: 25px;

    .skip-button {
      background: #fff;
      color: #666;
      border: 2px solid #ddd;
      font-size: 16px;
      padding: 12px 30px;
      border-radius: 50px;
      cursor: pointer;
      transition: all 0.2s;
      outline: none;

      &:hover {
        border-color: #bbb;
        color: #444;
      }
    }
  }
}

.button {
  margin: 0;
  font-size: 20px;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: rgba(0,0,0,0);
  -webkit-touch-callout: none;
  outline: none;
  display: inline-block;
  background-color: #fff;
  color: #646464;
  cursor: pointer;
  border: 0;
  border-radius: 50px;
  padding: 15px 45px;
  text-align: center;
  text-decoration: none !important;
  background: rgba(0,174,255,1);
  background: -webkit-gradient(left top, left bottom, color-stop(0%, rgba(0,174,255,1)), color-stop(92%, rgba(0,174,255,1)), color-stop(100%, rgba(0,144,234,1)));
  background: -webkit-linear-gradient(top, rgba(0,174,255,1) 0%, rgba(0,174,255,1) 92%, rgba(0,144,234,1) 100%);
  color: #fff;
  transition: box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1), background 0.1s linear;
  z-index: 1;
  position: relative;
  &.break, &.short-break, &.long-break {
    background: #0a0;
    box-shadow: 0 15px 8px -10px #00aa0055;
    color: #fff;
    &:hover {
      background: #0b0;
    }
  }
  &.focus {
    background: #d00;
    box-shadow: 0 15px 8px -10px #bb000055;
    color: #fff;
    &:hover {
      background: #e00;
    }
  }
  &:active {
    box-shadow: none;
    transition-delay: 0s;
  }
  &::not(.focus):not(.break):not(.short-break):not(.long-break) {
    display: none;
  }
}
.start-session {
  margin-top: 10px;
}
.pomodoros-today {
  margin-top: 60px;
  line-height: 100%;
}
.view-history {
  cursor: pointer;
  font-size: 15px;
  background: #fff;
  color: #555;
  border: 1px solid #555;
  border-radius: 3px;
  padding: 8px 25px;
  margin: 5px 0 0 0;
  outline: 0 !important;
  border-radius: 35px;
  &:hover {
    color: #a00;
    border: 1px solid #a00;
    text-decoration: none;
  }
}
.pomodoros i {
  font-size: 35px;
  margin-top: 7px;
  color: #d00 !important;
  text-shadow: 0 2px 2px rgba(200, 0, 0, 0.3);
}
.pomodoros:empty ~ * {
  display: none;
}
</style>

<script>
import M from '../Messages';
import { PomodoroClient, OptionsClient } from '../background/Services';
import { ExpirationClient } from '../background/Expiration';

export default {
  data() {
    return {
      show: false,
      title: '',
      action: '',
      message: '',
      phase: '',
      pomodoroCount: 0,
      currentTask: '',
      savedTags: [],
      recentPomodoros: [],
      isFocusSession: false
    };
  },
  computed: {
    M() {
      return M;
    }
  },
  async created() {
    document.title = `${M.expire_title} - ${M.app_name_short}`;
    document.body.addEventListener('keypress', this.onKeyPress);

    let { title, action, pomodoros, messages, phase } = await ExpirationClient.once.getProperties();
    this.show = true;
    this.title = title;
    this.action = action;
    this.pomodoroCount = pomodoros;
    this.message = messages.filter(m => m && m.trim()).join(' – ');
    this.phase = phase;
    // Show task input when a FOCUS session just completed (i.e., when about to take a break)
    this.isFocusSession = phase === 'short-break' || phase === 'long-break' || phase === 'break';

    console.log(`[Expire] Page loaded. Phase: ${phase}, isFocusSession: ${this.isFocusSession}`);

    // Load task and tags from storage if a focus session just completed
    if (this.isFocusSession) {
      await this.loadTaskAndTags();

      // Clear the task field to start fresh for this pomodoro
      this.currentTask = '';
      console.log('[Expire] Task field cleared, ready for new input');

      // Focus the textarea after a short delay
      this.$nextTick(() => {
        setTimeout(() => {
          if (this.$refs.taskInput) {
            this.$refs.taskInput.focus();
          }
        }, 300);
      });
    }
  },
  beforeDestroy() {
    document.body.removeEventListener('keypress', this.onKeyPress);
  },
  methods: {
    async loadTaskAndTags() {
      return new Promise((resolve) => {
        chrome.storage.local.get(['currentTask', 'savedTags', 'syncQueue'], (result) => {
          this.currentTask = result.currentTask || '';
          this.savedTags = result.savedTags || [];
          this.recentPomodoros = result.syncQueue || [];
          console.log('[Expire] Loaded from storage:', {
            currentTask: this.currentTask,
            savedTags: this.savedTags,
            recentPomodoros: this.recentPomodoros
          });
          resolve();
        });
      });
    },

    async saveTask() {
      console.log('[Expire] Saving task:', this.currentTask);
      return new Promise((resolve) => {
        chrome.storage.local.set({ currentTask: this.currentTask }, resolve);
      });
    },

    async clearTask() {
      console.log('[Expire] Clearing task');
      this.currentTask = '';
      return new Promise((resolve) => {
        chrome.storage.local.set({ currentTask: '' }, resolve);
      });
    },

    isTagInTask(tag) {
      const hashtag = `#${tag}`;
      return this.currentTask.includes(hashtag);
    },

    toggleTag(tag) {
      const hashtag = `#${tag}`;

      if (this.isTagInTask(tag)) {
        // Remove the tag
        this.currentTask = this.currentTask.replace(new RegExp(`\\s*${hashtag}\\b`, 'g'), '');
      } else {
        // Add the tag
        if (this.currentTask && !this.currentTask.endsWith(' ')) {
          this.currentTask += ' ';
        }
        this.currentTask += hashtag;
      }

      // Focus back to textarea
      if (this.$refs.taskInput) {
        this.$refs.taskInput.focus();
      }
    },

    async saveAndStartSession() {
      if (this.isFocusSession) {
        console.log('[Expire] User clicked Save. Task:', this.currentTask);

        // Send message to background to complete pomodoro with task
        chrome.runtime.sendMessage({
          action: 'completePomodoroWithTask',
          taskText: this.currentTask
        }, (response) => {
          console.log('[Expire] Background response:', response);
        });
      }
      this.startSession();
    },

    async skipAndStartSession() {
      if (this.isFocusSession) {
        console.log('[Expire] User clicked Skip');

        // Send message to background to complete pomodoro with empty task
        chrome.runtime.sendMessage({
          action: 'completePomodoroWithTask',
          taskText: ''
        }, (response) => {
          console.log('[Expire] Background response:', response);
        });
      }
      this.startSession();
    },

    startSession() {
      PomodoroClient.once.start();
    },

    showHistoryPage() {
      OptionsClient.once.showHistoryPage();
    },

    onKeyPress(e) {
      // On Enter key press (without Ctrl), do nothing if in task input
      if (e.key === 'Enter' && !e.ctrlKey && this.isFocusSession) {
        return;
      }

      // On Enter key press (for breaks, or Ctrl+Enter for focus), start next session
      if (e.key === 'Enter' && (!this.isFocusSession || e.ctrlKey)) {
        this.saveAndStartSession();
      }
    },

    formatDateTime(isoString) {
      if (!isoString) return '';
      const date = new Date(isoString);
      return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    },

    formatDuration(seconds) {
      if (!seconds) return '';
      const minutes = Math.floor(seconds / 60);
      return `${minutes}m`;
    },

    getAllTags() {
      // Get all unique tags from recent pomodoros
      const tagSet = new Set();
      this.recentPomodoros.forEach(pomo => {
        if (pomo.tags && Array.isArray(pomo.tags)) {
          pomo.tags.forEach(tag => tagSet.add(tag));
        }
      });
      return Array.from(tagSet).sort();
    }
  }
};
</script>
