<script setup lang="ts">
defineProps<{
  busy?: boolean;
  error?: boolean;
}>();

const emit = defineEmits<{
  continue: [];
}>();
</script>

<template>
<template v-if="error">
    <h1>Storage access was not granted</h1>
    <p>
    Reload the app to try again. Without this permission, the embedded guard
    may not be able to see your Graffiti session cookie.
    </p>
</template>
<template v-else>
    <h1>Allow session access</h1>
    <p>
    This app uses Graffiti Guard in an embedded frame. Continue to let the
    guard read your Graffiti session cookie and, when available, shared
    browser caches for this site.
    </p>
    <button type="button" :disabled="busy" @click="emit('continue')">
    {{ busy ? "Requesting access..." : "Continue" }}
    </button>
</template>
</template>
