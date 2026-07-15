<script setup lang="ts">
defineProps<{
  message: string;
}>();
</script>

<template>
    <h1>Guard host</h1>
    <p>{{ message }}</p>
</template>
