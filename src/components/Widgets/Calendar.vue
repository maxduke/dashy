<template>
<div class="calendar-wrapper">
  <p class="no-events" v-if="days && !days.length">{{ $t('widgets.calendar.no-events') }}</p>
  <div class="day-group" v-for="day in days" :key="day.label">
    <p class="day-label">{{ day.label }}</p>
    <component
      :is="event.url ? 'a' : 'div'"
      class="event-row"
      v-for="(event, index) in day.events"
      :key="index"
      :href="event.url || undefined"
      target="_blank"
      rel="noopener noreferrer"
      v-tooltip="eventTooltip(event)"
    >
      <span class="event-time" :class="{ 'all-day': event.allDay }">{{ event.time }}</span>
      <span class="event-title">
        <span class="calendar-dot" v-if="event.color" :style="{ background: event.color }"></span>
        {{ event.summary }}
      </span>
    </component>
  </div>
</div>
</template>

<script>
import WidgetMixin from '@/mixins/WidgetMixin';
import { parseIcs } from '@/utils/IcsParser';
import { sanitize } from '@/utils/MiscHelpers';
import { sanitizeText, sanitizeUrl } from '@/utils/Sanitizer';

export default {
  mixins: [WidgetMixin],
  components: {},
  data() {
    return {
      days: null,
      overrideProxyChoice: true,
    };
  },
  computed: {
    /* User's feed(s), normalised to a list of { url, name, color } */
    calendars() {
      const input = this.options.calendarUrl;
      if (!input) return [];
      const list = Array.isArray(input) ? input : [input];
      return list
        .map((entry) => (typeof entry === 'string' ? { url: entry } : entry))
        .filter((entry) => entry && entry.url)
        .map((entry) => ({
          ...entry,
          url: this.parseAsEnvVar(entry.url).replace(/^webcal:\/\//i, 'https://'),
        }));
    },
    /* Number of days ahead to show events for */
    daysAhead() {
      const usersChoice = this.options.days;
      if (usersChoice > 0 && usersChoice <= 365) return usersChoice;
      return 7;
    },
    limit() {
      return this.options.limit || 10;
    },
    hideAllDay() {
      return !!this.options.hideAllDay;
    },
    /* The window to fetch events for, starting now unless told otherwise */
    range() {
      const requested = this.options.startDate ? new Date(this.options.startDate).getTime() : NaN;
      const start = Number.isNaN(requested) ? Date.now() : requested;
      return { start, end: start + this.daysAhead * 86400000 };
    },
  },
  methods: {
    fetchData() {
      if (!this.calendars.length) {
        this.error('Missing calendarUrl, see the docs for supported formats');
        this.finishLoading();
        return;
      }
      if (this.options.startDate && Number.isNaN(new Date(this.options.startDate).getTime())) {
        this.error('Invalid startDate, expected a date like 2026-09-03');
      }
      const requests = this.calendars.map((calendar) => this.makeRequest(calendar.url));
      Promise.allSettled(requests).then((outcomes) => {
        const events = [];
        let readable = 0;
        outcomes.forEach((outcome, index) => {
          if (outcome.status !== 'fulfilled') return;
          if (this.readFeed(outcome.value, this.calendars[index], events)) readable += 1;
        });
        // Leave the widget empty if nothing could be read, so only the error shows
        if (!readable) return;
        events.sort((first, second) => first.start - second.start);
        this.days = this.groupByDay(events.slice(0, this.limit));
      });
    },
    /* Parse a single feed, appending its events to the combined list */
    readFeed(data, calendar, events) {
      let parsed;
      try {
        parsed = parseIcs(data, this.range);
      } catch (error) {
        this.error(`Unable to parse calendar${calendar.name ? ` '${calendar.name}'` : ''}`, error);
        return false;
      }
      parsed.forEach((event) => {
        if (this.hideAllDay && event.allDay) return;
        events.push({
          ...event,
          summary: event.summary || this.$t('widgets.calendar.untitled'),
          // Feeds often put markup in the description, but never in the other fields
          description: sanitizeText(event.description),
          url: sanitizeUrl(event.url) || '',
          source: calendar.name || '',
          color: calendar.color || '',
        });
      });
      return true;
    },
    /* Bucket events under a heading for the day they fall on */
    groupByDay(events) {
      const groups = [];
      events.forEach((event) => {
        const label = this.dayLabel(event);
        const current = groups[groups.length - 1];
        const time = event.allDay
          ? this.$t('widgets.calendar.all-day') : this.formatTime(event.start);
        const formatted = { ...event, time };
        if (current && current.label === label) current.events.push(formatted);
        else groups.push({ label, events: [formatted] });
      });
      return groups;
    },
    /* All-day events are anchored to UTC, so must be read back in UTC */
    eventDate(event) {
      const date = new Date(event.start);
      return event.allDay
        ? new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
        : new Date(date.getFullYear(), date.getMonth(), date.getDate());
    },
    dayLabel(event) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const date = this.eventDate(event);
      const daysAway = Math.round((date - today) / 86400000);
      if (daysAway === 0) return this.$t('widgets.calendar.today');
      if (daysAway === 1) return this.$t('widgets.calendar.tomorrow');
      return date.toLocaleDateString(navigator.language, {
        weekday: 'short', day: 'numeric', month: 'short',
      });
    },
    formatTime(timestamp) {
      return new Date(timestamp).toLocaleTimeString(navigator.language, {
        hour: '2-digit', minute: '2-digit',
      });
    },
    eventTooltip(event) {
      const lines = [];
      if (event.source) lines.push(`<b>${sanitize(event.source)}</b>`);
      if (!event.allDay && event.end > event.start) {
        lines.push(`${event.time} - ${this.formatTime(event.end)}`);
      }
      if (event.location) lines.push(sanitize(event.location));
      if (event.description) lines.push(sanitize(event.description.slice(0, 200)));
      if (!lines.length) return { content: '' };
      return { content: lines.join('<br>'), html: true, popperClass: 'calendar-event-tt' };
    },
  },
};
</script>

<style scoped lang="scss">
.calendar-wrapper {
  padding: 0.25rem 0;
  color: var(--widget-text-color);
  p.no-events {
    margin: 0.5rem 0;
    text-align: center;
    opacity: var(--dimming-factor);
  }
  .day-group {
    &:not(:last-child) { margin-bottom: 0.5rem; }
    p.day-label {
      margin: 0 0 0.15rem;
      font-size: 0.8rem;
      font-weight: bold;
      text-transform: uppercase;
      opacity: var(--dimming-factor);
      border-bottom: 1px dashed var(--widget-text-color);
    }
  }
  .event-row {
    display: grid;
    grid-template-columns: 4.2rem 1fr;
    gap: 0.4rem;
    padding: 0.15rem 0;
    font-size: 0.9rem;
    text-decoration: none;
    color: var(--widget-text-color);
    .event-time {
      font-variant-numeric: tabular-nums;
      opacity: var(--dimming-factor);
      &.all-day { font-size: 0.75rem; }
    }
    .event-title {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .calendar-dot {
      display: inline-block;
      width: 0.5rem;
      height: 0.5rem;
      margin-right: 0.25rem;
      border-radius: 50%;
    }
    &[href]:hover {
      opacity: 1;
      text-decoration: underline;
    }
  }
}
</style>

<style lang="scss">
.calendar-event-tt {
  max-width: 20rem;
}
</style>
