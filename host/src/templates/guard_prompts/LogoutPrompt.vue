<script setup lang="ts">
import type { LogoutPromptResult } from "../../method_guards/utils";

defineProps<{
  sourceId: string;
  onResolve: (result: LogoutPromptResult) => void;
}>();
</script>

<template>
  <section>
    <h1>Logout request</h1>
    <p>
      <strong>{{ sourceId }}</strong> wants to log you out of Graffiti.
    </p>
    <menu>
      <button type="button" class="secondary" @click="onResolve('deny')">
        Deny
      </button>
      <button type="button" @click="onResolve('allow-once')">
        Allow once
      </button>
      <button type="button" @click="onResolve('remember')">
        Remember logouts
      </button>
    </menu>
  </section>
</template>

<style scoped>
@import "./prompt.css";
</style>
