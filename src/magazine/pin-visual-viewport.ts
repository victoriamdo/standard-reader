/** Pin a fixed shell to the visible viewport (iOS Safari floating chrome). */
export function pinElementToVisualViewport(el: HTMLElement): () => void {
  if (globalThis.window === undefined) return () => {};

  const sync = () => {
    const vv = globalThis.visualViewport;
    if (!vv) {
      el.style.removeProperty("top");
      el.style.removeProperty("left");
      el.style.removeProperty("width");
      el.style.removeProperty("height");
      return;
    }
    el.style.top = `${vv.offsetTop}px`;
    el.style.left = `${vv.offsetLeft}px`;
    el.style.width = `${vv.width}px`;
    el.style.height = `${vv.height}px`;
  };

  sync();
  const vv = globalThis.visualViewport;
  vv?.addEventListener("resize", sync);
  vv?.addEventListener("scroll", sync);
  globalThis.addEventListener("resize", sync);
  globalThis.addEventListener("orientationchange", sync);

  return () => {
    vv?.removeEventListener("resize", sync);
    vv?.removeEventListener("scroll", sync);
    globalThis.removeEventListener("resize", sync);
    globalThis.removeEventListener("orientationchange", sync);
    el.style.removeProperty("top");
    el.style.removeProperty("left");
    el.style.removeProperty("width");
    el.style.removeProperty("height");
  };
}
