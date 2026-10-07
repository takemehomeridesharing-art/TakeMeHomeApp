/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the Take Me Home API. Defaults to port 4000 on the current host. */
  readonly VITE_API_URL?: string;
}
