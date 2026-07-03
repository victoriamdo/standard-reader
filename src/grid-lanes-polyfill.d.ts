declare module "grid-lanes-polyfill/grid-lanes-polyfill.js" {
  export interface GridLanesPolyfillInstance {
    refresh(): void;
    destroy(): void;
  }

  export interface GridLanesPolyfillOptions {
    force?: boolean;
  }

  export function supportsGridLanes(): boolean;
  export function init(
    options?: GridLanesPolyfillOptions,
  ): GridLanesPolyfillInstance;
  export function apply(
    element: Element,
    options?: GridLanesPolyfillOptions,
  ): GridLanesPolyfillInstance | null;

  export class GridLanesLayout implements GridLanesPolyfillInstance {
    refresh(): void;
    destroy(): void;
  }

  const GridLanesPolyfill: {
    supportsGridLanes: typeof supportsGridLanes;
    init: typeof init;
    apply: typeof apply;
    GridLanesLayout: typeof GridLanesLayout;
    version: string;
  };

  export default GridLanesPolyfill;
}
