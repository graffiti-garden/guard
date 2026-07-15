<script setup lang="ts">
import { computed, ref } from "vue";
import type { DiscoverPromptResult } from "../../method_guards/utils";

const props = defineProps<{
  sourceId: string;
  channels: string[];
  schema: unknown;
  onResolve: (result: DiscoverPromptResult) => void;
}>();

const anyChannels = ref(true);
const details = computed(() =>
  JSON.stringify(
    {
      channels: props.channels,
      schema: props.schema,
    },
    null,
    2,
  ),
);

function allowLikeThis() {
  props.onResolve({
    kind: "allow-like-this",
    channels: anyChannels.value ? undefined : [...props.channels],
  });
}
</script>

<template>
  <section>
    <h1>Discover request</h1>
    <p>
      <strong>{{ sourceId }}</strong> wants to discover Graffiti objects.
    </p>
    <pre>{{ details }}</pre>
    <fieldset>
      <legend>Allow like this</legend>
      <label>
        <input v-model="anyChannels" type="checkbox" />
        Allow any channels
      </label>
    </fieldset>
    <menu>
      <button
        type="button"
        class="secondary"
        @click="onResolve({ kind: 'deny' })"
      >
        Deny
      </button>
      <button type="button" @click="onResolve({ kind: 'allow-once' })">
        Allow once
      </button>
      <button type="button" @click="allowLikeThis">Allow like this</button>
    </menu>
  </section>
</template>

<style scoped>
@import "./prompt.css";
</style>
