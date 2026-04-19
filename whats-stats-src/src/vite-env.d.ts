/// <reference types="svelte" />
/// <reference types="vite/client" />

declare module 'plotly.js-dist-min' {
  const Plotly: {
    newPlot(
      root: HTMLElement,
      data: object | object[],
      layout?: object,
      config?: object
    ): Promise<unknown>;
    purge(root: HTMLElement): void;
  };
  export default Plotly;
}
