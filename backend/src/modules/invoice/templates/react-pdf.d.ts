/**
 * Local type declarations for @react-pdf/renderer.
 *
 * The upstream package is ESM-only ("type": "module") but Medusa's backend
 * compiles with "module": "Node16" and no "type": "module" in package.json,
 * so TypeScript treats our .ts/.tsx files as CJS and refuses the static
 * import. At runtime Medusa's toolchain (SWC/esbuild) handles the interop
 * fine — this declaration simply tells the type-checker the import is valid.
 *
 * We re-export only the subset of types and values our invoice templates use.
 */
declare module "@react-pdf/renderer" {
  import * as React from "react";
  import { Style } from "@react-pdf/types";

  // ---- Style helpers ----
  interface Styles {
    [key: string]: Style;
  }

  export const StyleSheet: {
    create: <T extends Styles>(styles: T) => T;
  };

  // ---- Document & Page ----
  interface DocumentProps {
    style?: Style | Style[];
    title?: string;
    author?: string;
    subject?: string;
    creator?: string;
    keywords?: string;
    producer?: string;
    language?: string;
    onRender?: (props: { blob?: Blob }) => void;
    children?: React.ReactNode;
  }

  export class Document extends React.Component<DocumentProps> {}

  interface PageProps {
    id?: string;
    style?: Style | Style[];
    size?: string | number | [number, number];
    orientation?: "portrait" | "landscape";
    wrap?: boolean;
    debug?: boolean;
    dpi?: number;
    children?: React.ReactNode;
  }

  export class Page extends React.Component<PageProps> {}

  // ---- Primitives ----
  interface ViewProps {
    id?: string;
    style?: Style | Style[];
    fixed?: boolean;
    break?: boolean;
    wrap?: boolean;
    debug?: boolean;
    render?: (props: {
      pageNumber: number;
      subPageNumber: number;
    }) => React.ReactNode;
    children?: React.ReactNode;
  }

  export class View extends React.Component<ViewProps> {}

  interface TextProps {
    id?: string;
    style?: Style | Style[];
    fixed?: boolean;
    break?: boolean;
    wrap?: boolean;
    debug?: boolean;
    render?: (props: {
      pageNumber: number;
      totalPages: number;
      subPageNumber: number;
      subPageTotalPages: number;
    }) => React.ReactNode;
    orphans?: number;
    widows?: number;
    children?: React.ReactNode;
  }

  export class Text extends React.Component<TextProps> {}

  interface ImageProps {
    style?: Style | Style[];
    src?:
      | string
      | {
          uri: string;
          method?: string;
          headers?: Record<string, string>;
          body?: string;
        };
    source?:
      | string
      | {
          uri: string;
          method?: string;
          headers?: Record<string, string>;
          body?: string;
        };
    fixed?: boolean;
    debug?: boolean;
    cache?: boolean;
  }

  export class Image extends React.Component<ImageProps> {}

  interface LinkProps {
    style?: Style | Style[];
    href?: string;
    src?: string;
    fixed?: boolean;
    debug?: boolean;
    wrap?: boolean;
    children?: React.ReactNode;
  }

  export class Link extends React.Component<LinkProps> {}

  // ---- Rendering (server-side) ----
  // Widened from ReactElement<DocumentProps> to ReactElement to avoid
  // needing `as any` casts when passing createElement() results
  export const renderToBuffer: (
    document: React.ReactElement,
  ) => Promise<Buffer>;

  export const renderToStream: (
    document: React.ReactElement,
  ) => Promise<NodeJS.ReadableStream>;

  export const pdf: (initialValue?: React.ReactElement) => {
    container: unknown;
    isDirty: () => boolean;
    toString: () => string;
    toBlob: () => Promise<Blob>;
    toBuffer: () => Promise<NodeJS.ReadableStream>;
    on: (event: "change", callback: () => void) => void;
    updateContainer: (
      document: React.ReactElement<DocumentProps>,
      callback?: () => void,
    ) => void;
    removeListener: (event: "change", callback: () => void) => void;
  };
}
