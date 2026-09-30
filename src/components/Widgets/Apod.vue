<template>
<div class="apod-wrapper" v-if="title">
  <a :href="articleUrl" class="title" target="_blank" rel="noopener noreferrer" title="View Article">
    {{ title }}
  </a>
  <a
    v-if="image"
    :href="mediaLink"
    :title="isVideo ? null : 'View HD Image'"
    class="picture"
    target="_blank"
    rel="noopener noreferrer"
  >
    <img :src="image" :alt="title" />
  </a>
  <a v-if="isVideo" :href="mediaLink" class="watch-video" target="_blank" rel="noopener noreferrer">
    {{ $t('widgets.apod.watch-video') }}
  </a>
  <p class="copyright" v-if="copyright">{{ copyright }}</p>
  <p class="explanation">{{ truncatedExplanation }}</p>
  <p @click="toggleShowFull" class="expend-details-btn" v-if="isTruncated">
    {{ showFullExp ? $t('widgets.general.show-less') : $t('widgets.general.show-more') }}
  </p>
</div>
</template>

<script>
import WidgetMixin from '@/mixins/WidgetMixin';
import { widgetApiEndpoints } from '@/utils/config/defaults';

export default {
  mixins: [WidgetMixin],
  data() {
    return {
      title: null,
      date: null,
      mediaType: null,
      url: null,
      hdurl: null,
      thumbnail: null,
      explanation: '',
      copyright: null,
      showFullExp: false,
    };
  },
  computed: {
    endpoint() {
      const host = this.parseAsEnvVar(this.options.hostname);
      return host ? `${host.replace(/\/+$/, '')}/apod` : widgetApiEndpoints.astronomyPictureOfTheDay;
    },
    articleUrl() {
      const base = 'https://science.nasa.gov/apod/';
      return this.date ? `${base}?date=${this.date}` : base;
    },
    isVideo() {
      return this.mediaType === 'video';
    },
    image() {
      return this.isVideo ? this.thumbnail : this.url || this.hdurl;
    },
    mediaLink() {
      return (this.isVideo ? this.url : this.hdurl || this.url) || this.articleUrl;
    },
    isTruncated() {
      return this.explanation.length > 100;
    },
    truncatedExplanation() {
      if (this.showFullExp || !this.isTruncated) return this.explanation;
      return `${this.explanation.slice(0, 100).replace(/\s+\S*$/, '')}...`;
    },
  },
  methods: {
    fetchData() {
      this.makeRequest(this.endpoint).then(this.processData);
    },
    processData(data) {
      if (!data?.title) {
        this.error('Unexpected response from APOD API', data);
        return;
      }
      this.title = data.title;
      this.date = data.date;
      this.mediaType = data.media_type;
      this.url = data.url;
      this.hdurl = data.hdurl;
      this.thumbnail = data.thumbnail_url;
      this.explanation = data.explanation || '';
      this.copyright = data.copyright;
    },
    toggleShowFull() {
      this.showFullExp = !this.showFullExp;
    },
  },
};
</script>

<style scoped lang="scss">
.apod-wrapper {
  display: flow-root;
  a.title {
    font-size: 1.5rem;
    margin: 0.5rem 0;
    color: var(--widget-text-color);
    text-decoration: none;
    &:hover { text-decoration: underline; }
  }
  a.picture img {
    width: 100%;
    margin: 0.5rem auto;
    border-radius: var(--curve-factor);
  }
  a.watch-video {
    display: block;
    margin: 0.2rem 0;
    color: var(--widget-text-color);
  }
  p.copyright {
    font-size: 0.8rem;
    margin: 0.2rem 0;
    opacity: var(--dimming-factor);
    color: var(--widget-text-color);
  }
  p.explanation {
    color: var(--widget-text-color);
    font-size: 1rem;
    margin: 0.5rem 0;
  }
  p.expend-details-btn {
    cursor: pointer;
    float: right;
    margin: 0;
    padding: 0.1rem 0.25rem;
    border: 1px solid transparent;
    color: var(--widget-text-color);
    opacity: var(--dimming-factor);
    border-radius: var(--curve-factor);
    &:hover {
      border: 1px solid var(--widget-text-color);
    }
    &:focus, &:active {
      background: var(--widget-text-color);
      color: var(--widget-background-color);
    }
  }
}

</style>
