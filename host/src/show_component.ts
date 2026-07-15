import { markRaw, shallowReactive, type Component } from "vue";

export const componentState = shallowReactive<{
  component: Component | null;
  params: Record<string, unknown>;
}>({
  component: null,
  params: {},
});

export function showComponent(
  component: Component,
  params: Record<string, unknown> = {},
) {
  componentState.component = markRaw(component);
  componentState.params = params;
}
