<template>
  <div class="workspace-widget-view">
    <WidgetBase
      v-for="(widget, widgetIndx) in widgets"
      :key="widget.id || widgetIndx"
      :widget="widget"
      :index="widgetIndx"
      class="workspace-widget"
    />
  </div>
</template>

<script>
import WidgetBase from '@/components/Widgets/WidgetBase';

export default {
  name: 'WidgetView',
  components: {
    WidgetBase,
  },
  props: {
    widgets: { type: Array, default: () => [] },
  },
};
</script>

<style lang="scss" scoped>
@import '@/styles/style-helpers.scss';

.workspace-widget-view {
  flex: 1;
  min-width: 0;
  padding: 1rem;
  overflow-y: auto;
  background: var(--background);
  @extend .scroll-bar;
  .workspace-widget {
    max-width: 800px;
    margin: 0.5rem auto 1rem auto;
  }
}
</style>
