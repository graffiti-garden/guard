<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  sourceId: string;
  method: string;
  args: unknown[];
  onResolve: (result: boolean) => void;
}>();

const details = computed(() => JSON.stringify(props.args, null, 2));
</script>

<template>
  <section>
    <h1>Method request</h1>
    <p>
      <strong>{{ sourceId }}</strong> wants to call
      <code>{{ method }}</code>.
    </p>
    <pre>{{ details }}</pre>
    <menu>
      <button type="button" class="secondary" @click="onResolve(false)">
        Deny
      </button>
      <button type="button" @click="onResolve(true)">Allow once</button>
    </menu>
  </section>
</template>

<style scoped>
@import "./prompt.css";
</style>
