/// <reference types="vite/client" />

/**
 * Vite's client types (import.meta.env). This file is the Vite convention and
 * was missing, so any use of import.meta.env failed to type-check.
 */
interface ImportMetaEnv {
  /** Opt in to the internal 18-stage journey simulator outside staff accounts. */
  readonly VITE_SHOW_JOURNEY_SIMULATOR?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
