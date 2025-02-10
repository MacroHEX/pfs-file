/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬─┬ dist
     * │ │ └── index.html
     * │ │
     * │ ├─┬ dist-electron
     * │ │ ├── main.js
     * │ │ └── preload.js
     * │
     * ```
     */
    APP_ROOT: string
    /** /dist/ or /public/ */
    VITE_PUBLIC: string
  }
}

// Used in Renderer process, expose in `preload.ts`
interface Window {
  ipcRenderer: {
    send: (channel: string, ...args: unknown[]) => void;
    invoke: <T = unknown>(channel: string, ...args: unknown[]) => Promise<T>;
    on: <T>(channel: string, listener: (event: IpcRendererEvent, data: T) => void) => void;
    off: <T>(channel: string, listener: (event: IpcRendererEvent, data: T) => void) => void;

    selectFile: (options?: OpenDialogOptions) => Promise<string | null>;
    selectOutputDir: (options?: OpenDialogOptions) => Promise<string | null>;
  };
}

interface IpcRendererEvent {
  sender: IpcRenderer;
  senderId: number;
}