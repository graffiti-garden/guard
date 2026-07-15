<script setup lang="ts">
import { componentState } from "./show_component";
</script>

<template>
    <main>
        <component
          :is="componentState.component"
          v-if="componentState.component"
          v-bind="componentState.params"
        />
    </main>
</template>
