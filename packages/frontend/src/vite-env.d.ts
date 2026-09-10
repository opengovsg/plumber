/// <reference types="vite/client" />

// CSS-only font package, has no type declarations of its own.
declare module '@fontsource/space-grotesk'

declare namespace JSX {
  interface IntrinsicElements {
    // oxlint-disable-next-line typescript/no-explicit-any
    'json-viewer': any
  }
}
