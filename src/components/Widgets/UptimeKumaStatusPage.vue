<template>
  <div @click="openStatusPage" class="clickable-widget">
    <template v-if="errorMessage">
      <div class="error-message">
        <span class="text">{{ errorMessage }}</span>
      </div>
    </template>
    <template v-else-if="lastHeartbeats">
      <div
        v-for="(heartbeat, index) in lastHeartbeats"
        :key="index"
        class="item-wrapper"
      >
        <div class="item monitor-row">
          <div class="title-title">
            <span class="text">{{ heartbeat.name }}</span>
          </div>
          <div class="monitors-container">
            <div class="status-container">
              <span
                class="status-pill"
                :class="getStatusClass(heartbeat.status)"
              >
                {{ getStatusText(heartbeat.status) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script>
import WidgetMixin from '@/mixins/WidgetMixin';

export default {
  mixins: [WidgetMixin],
  data() {
    return {
      lastHeartbeats: null,
      errorMessage: null,
      errorMessageConstants: {
        missingHost: 'No host set',
        missingSlug: 'No slug set',
      },
    };
  },
  computed: {
    host() {
      return this.parseAsEnvVar(this.options.host);
    },
    slug() {
      return this.parseAsEnvVar(this.options.slug);
    },
    monitorNames() {
      return Array.isArray(this.options.monitorNames) ? this.options.monitorNames : [];
    },
    endpoint() {
      return `${this.host}/api/status-page/heartbeat/${this.slug}`;
    },
    /* Monitor names aren't in the heartbeat response, they're only here */
    configEndpoint() {
      return `${this.host}/api/status-page/${this.slug}`;
    },
    statusPageUrl() {
      return `${this.host}/status/${this.slug}`;
    },
  },
  mounted() {
    this.fetchData();
  },
  methods: {
    update() {
      this.startLoading();
      this.fetchData();
    },
    fetchData() {
      const { host, slug } = this;
      if (!this.optionsValid({ host, slug })) {
        return;
      }
      Promise.all([
        this.makeRequest(this.endpoint), // Get uptime data
        this.makeRequest(this.configEndpoint).catch(() => null), // attempt get monitor names
      ])
        .then(([heartbeats, statusPage]) => this.processData(heartbeats, statusPage))
        .catch((error) => {
          this.errorMessage = error.message || 'Failed to fetch data';
        });
    },
    processData(response, statusPage) {
      const { heartbeatList } = response;
      this.lastHeartbeats = this.getOrderedMonitors(statusPage, heartbeatList)
        .map((monitor, index) => {
          const heartbeats = heartbeatList[monitor.id];
          return {
            ...heartbeats[heartbeats.length - 1],
            name: this.monitorNames[index] || monitor.name || `Monitor ${index + 1}`,
          };
        });
    },
    /* Monitors which have heartbeats, in the same order as the status page */
    getOrderedMonitors(statusPage, heartbeatList) {
      const groups = statusPage?.publicGroupList;
      const monitors = groups
        ? groups.flatMap((group) => group.monitorList)
        : Object.keys(heartbeatList).map((id) => ({ id }));
      return monitors.filter((monitor) => heartbeatList[monitor.id]?.length > 0);
    },
    optionsValid({ host, slug }) {
      const errors = [];
      if (!host) errors.push(this.errorMessageConstants.missingHost);
      if (!slug) errors.push(this.errorMessageConstants.missingSlug);
      if (errors.length > 0) {
        this.errorMessage = errors.join('\n');
        return false;
      }
      return true;
    },
    openStatusPage() {
      window.open(this.statusPageUrl, '_blank');
    },
    getStatusText(status) {
      switch (status) {
        case 1:
          return 'Up';
        case 0:
          return 'Down';
        case 2:
          return 'Pending';
        case 3:
          return 'Maintenance';
        default:
          return 'Unknown';
      }
    },
    getStatusClass(status) {
      switch (status) {
        case 1:
          return 'up';
        case 0:
          return 'down';
        case 2:
          return 'pending';
        case 3:
          return 'maintenance';
        default:
          return 'unknown';
      }
    },
  },
};
</script>

<style scoped lang="scss">
.clickable-widget {
  cursor: pointer;
}
.status-pill {
  border-radius: 50em;
  box-sizing: border-box;
  font-size: 0.75em;
  display: inline-block;
  font-weight: 700;
  text-align: center;
  white-space: nowrap;
  vertical-align: baseline;
  padding: 0.35em 0.65em;
  margin: 0.1em 0.5em;
  min-width: 64px;
  &.up {
    background-color: var(--success);
    color: var(--black);
  }
  &.down {
    background-color: var(--danger);
    color: var(--white);
  }
  &.pending {
    background-color: var(--warning);
    color: var(--black);
  }
  &.maintenance {
    background-color: var(--info);
    color: var(--black);
  }
  &.unknown {
    background-color: var(--neutral);
    color: var(--white);
  }
}
.monitor-row {
  display: flex;
  justify-content: space-between;
  padding: 0.35em 0.5em;
  align-items: center;
}
.title-title {
  font-weight: bold;
}
.error-message {
  color: var(--danger);
  font-weight: bold;
}
</style>
