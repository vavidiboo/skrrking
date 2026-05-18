import type { SkullKingFXBridge } from "./types";

declare module "*.html" {
  const content: string;
  export default content;
}

declare module "react" {
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined;
  }
}

declare global {
  interface Window {
    SkullKingFX?: SkullKingFXBridge;
  }
}

export {};
