/// <reference types="vite/client" />
/// <reference types="@foldkit/markdown/content" />

interface ImportMetaEnv {
  /** Set by the stack (`alchemy.run.ts`). */
  readonly VITE_API_URL: string;
}
