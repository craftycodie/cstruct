<script setup lang="ts">
import DefaultTheme from "vitepress/theme";
</script>

<template>
  <div class="cstruct-layout">
    <div class="cstruct-hero-bg" aria-hidden="true" />
    <DefaultTheme.Layout />
  </div>
</template>

<style scoped>
.cstruct-layout {
  position: relative;
  min-height: 100vh;
  background-color: #0a080e;
}

/* Single gradient on a solid base — avoids rgba stack + blur banding */
.cstruct-hero-bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  pointer-events: none;
  background-color: #0a080e;
  background-image: radial-gradient(
    120% 85% at 50% -15%,
    #1c1428 0%,
    #13101a 38%,
    #0a080e 72%
  );
}

.cstruct-layout :deep(.Layout) {
  position: relative;
  z-index: 1;
}
</style>
