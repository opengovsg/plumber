// `moduleResolution: node` ignores package `exports`, so TypeScript cannot find this subpath.
// IMPORTANT: do not use tsconfig `paths` instead. ts-node and tsc-alias apply it at runtime.
declare module '@posthog/ai/otel' {
  export * from '@posthog/ai/dist/otel'
}
