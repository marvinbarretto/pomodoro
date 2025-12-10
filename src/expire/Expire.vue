<template>
  <div class="dialog" v-if="show">
    <h1>{{ title }}</h1>
    <div><p>{{ message }}</p></div>

    <!-- Task input form - only show after focus sessions complete (before taking a break) -->
    <div v-if="isFocusSession" class="task-section">
      <div class="task-header">
        <h3>{{ M.what_did_you_work_on || 'What did you work on?' }}</h3>
      </div>

      <!-- Tag usage chart -->
      <div v-if="tagStats.length > 0" class="tag-stats">
        <div class="stats-header">
          <div class="stats-label">{{ timeframeLabel }}:</div>
          <div class="timeframe-toggles">
            <button
              @click="selectedTimeframe = 'today'"
              :class="{ active: selectedTimeframe === 'today' }"
              class="timeframe-btn"
            >Today</button>
            <button
              @click="selectedTimeframe = 'week'"
              :class="{ active: selectedTimeframe === 'week' }"
              class="timeframe-btn"
            >Week</button>
            <button
              @click="selectedTimeframe = 'month'"
              :class="{ active: selectedTimeframe === 'month' }"
              class="timeframe-btn"
            >Month</button>
          </div>
        </div>
        <div class="stats-bars">
          <div v-for="stat in tagStats" :key="stat.tag" class="stat-row">
            <div class="stat-tag">#{{ stat.tag }}</div>
            <div class="stat-bar-container">
              <div class="stat-bar" :style="{ width: stat.percentage + '%' }"></div>
            </div>
            <div class="stat-count">{{ stat.count }}</div>
          </div>
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
  margin: 20px auto;
  width: 600px;
  max-width: 90%;

  .task-header {
    margin-bottom: 15px;

    h3 {
      font-size: 20px;
      font-weight: 600;
      color: #333;
      margin: 0;
    }
  }

  .tag-stats {
    margin-bottom: 20px;
    background: #f5f5f5;
    border-radius: 6px;
    padding: 12px 15px;

    .stats-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .stats-label {
      font-size: 13px;
      font-weight: 600;
      color: #666;
      text-align: left;
    }

    .timeframe-toggles {
      display: flex;
      gap: 6px;
    }

    .timeframe-btn {
      padding: 4px 12px;
      font-size: 12px;
      border: 1px solid #ccc;
      background: #fff;
      color: #666;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s;
      outline: none;
      font-family: 'Source Sans Pro', sans-serif;
      font-weight: 500;

      &:hover {
        border-color: #0ae;
        color: #0ae;
      }

      &.active {
        background: #0ae;
        color: #fff;
        border-color: #0ae;
      }
    }

    .stats-bars {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .stat-row {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
    }

    .stat-tag {
      min-width: 80px;
      text-align: left;
      font-weight: 500;
      color: #0ae;
    }

    .stat-bar-container {
      flex: 1;
      background: #e0e0e0;
      border-radius: 10px;
      height: 18px;
      overflow: hidden;
    }

    .stat-bar {
      height: 100%;
      background: linear-gradient(90deg, #0ae 0%, #0ae 100%);
      border-radius: 10px;
      transition: width 0.3s ease;
    }

    .stat-count {
      min-width: 25px;
      text-align: right;
      font-weight: 600;
      color: #555;
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
    margin-top: 30px;
    padding-top: 20px;
    border-top: 1px solid #e0e0e0;

    .skip-button {
      background: #fff;
      color: #666;
      border: 2px solid #ddd;
      font-size: 17px;
      padding: 14px 35px;
      border-radius: 50px;
      cursor: pointer;
      transition: all 0.2s;
      outline: none;
      font-weight: 500;

      &:hover {
        border-color: #999;
        color: #333;
        transform: translateY(-1px);
      }
    }
  }
}

.button {
  margin: 0;
  font-size: 21px;
  font-weight: 600;
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
  padding: 16px 50px;
  text-align: center;
  text-decoration: none !important;
  background: rgba(0,174,255,1);
  background: -webkit-gradient(left top, left bottom, color-stop(0%, rgba(0,174,255,1)), color-stop(92%, rgba(0,174,255,1)), color-stop(100%, rgba(0,144,234,1)));
  background: -webkit-linear-gradient(top, rgba(0,174,255,1) 0%, rgba(0,174,255,1) 92%, rgba(0,144,234,1) 100%);
  color: #fff;
  transition: box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1), background 0.1s linear, transform 0.2s;
  z-index: 1;
  position: relative;
  &.break, &.short-break, &.long-break {
    background: #0a0;
    box-shadow: 0 15px 8px -10px #00aa0055;
    color: #fff;
    &:hover {
      background: #0b0;
      transform: translateY(-2px);
      box-shadow: 0 18px 12px -10px #00aa0077;
    }
  }
  &.focus {
    background: #d00;
    box-shadow: 0 15px 8px -10px #bb000055;
    color: #fff;
    &:hover {
      background: #e00;
      transform: translateY(-2px);
      box-shadow: 0 18px 12px -10px #bb000077;
    }
  }
  &:active {
    transform: translateY(0);
    box-shadow: 0 10px 6px -10px #00000055;
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
  margin-top: 50px;
  padding-top: 30px;
  border-top: 2px solid #f0f0f0;
  line-height: 100%;

  p {
    font-weight: 500;
  }
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
      isFocusSession: false,
      selectedTimeframe: 'week'
    };
  },
  computed: {
    M() {
      return M;
    },
    timeframeLabel() {
      const labels = {
        today: 'Tag usage (today)',
        week: 'Tag usage (this week)',
        month: 'Tag usage (this month)'
      };
      return labels[this.selectedTimeframe] || 'Tag usage';
    },
    tagStats() {
      // Calculate tag frequency based on selected timeframe
      const tagCounts = {};
      const now = new Date();
      let startDate;

      // Determine start date based on timeframe
      if (this.selectedTimeframe === 'today') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
      } else if (this.selectedTimeframe === 'week') {
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
      } else if (this.selectedTimeframe === 'month') {
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 30);
      }

      this.recentPomodoros.forEach(pomo => {
        // Filter by selected timeframe
        if (pomo.ended_at && new Date(pomo.ended_at) >= startDate) {
          if (pomo.tags && Array.isArray(pomo.tags)) {
            pomo.tags.forEach(tag => {
              tagCounts[tag] = (tagCounts[tag] || 0) + 1;
            });
          }
        }
      });

      // Convert to array and sort by count
      const stats = Object.entries(tagCounts)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5); // Show top 5 tags

      // Calculate percentages
      const maxCount = stats.length > 0 ? stats[0].count : 1;
      return stats.map(stat => ({
        ...stat,
        percentage: (stat.count / maxCount) * 100
      }));
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

  }
};
</script>
