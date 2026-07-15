<script setup lang="ts">
import { computed, ref } from "vue";
import type {
  ApprovableObject,
  ObjectPromptResult,
} from "../../method_guards/utils";

const props = defineProps<{
  sourceId: string;
  action: "post" | "get" | "delete";
  object: ApprovableObject;
  exactUrl?: boolean;
  onResolve: (result: ObjectPromptResult) => void;
}>();

const anyChannels = ref(true);
const anyAllowed = ref(true);
const hasAllowed = computed(() => Array.isArray(props.object.allowed));
const title = computed(
  () => `${props.action.charAt(0).toUpperCase()}${props.action.slice(1)} request`,
);
const details = computed(() => JSON.stringify(props.object, null, 2));

function allowLikeThis() {
  props.onResolve({
    kind: "allow-like-this",
    channels: anyChannels.value ? undefined : [...props.object.channels],
    allowed:
      hasAllowed.value && !anyAllowed.value
        ? [...(props.object.allowed as string[])]
        : undefined,
  });
}
</script>

<template>
  <section>
    <h1>{{ title }}</h1>
    <p>
      <strong>{{ sourceId }}</strong> wants to {{ action }} this object.
    </p>
    <pre>{{ details }}</pre>
    <fieldset>
      <legend>Allow like this</legend>
      <label>
        <input v-model="anyChannels" type="checkbox" />
        Allow any channels
      </label>
      <label v-if="hasAllowed">
        <input v-model="anyAllowed" type="checkbox" />
        Allow any allowed actors
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
      <button
        v-if="exactUrl"
        type="button"
        @click="onResolve({ kind: 'allow-exact-url' })"
      >
        Allow exact URL
      </button>
      <button type="button" @click="allowLikeThis">Allow like this</button>
    </menu>
  </section>
</template>

<style scoped>
@import "./prompt.css";
</style>
