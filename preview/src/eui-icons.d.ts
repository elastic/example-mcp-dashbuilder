declare module '@elastic/eui/es/components/icon/icon' {
  export function appendIconComponentCache(icons: Record<string, unknown>): void;
}

declare module '@elastic/eui/es/components/icon/assets/*' {
  export const icon: unknown;
}
