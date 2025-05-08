import { type PluginImpl, type WarningHandlerWithDefault } from "rollup"
import { type SourceMapOptions as PostCssSourceMapOptions } from "postcss";

declare interface ProcessArgs {
  code: string
  filePath: string
  options?: any
}

declare interface Loader {
  name: string
  regex: string
  process: (arg: ProcessArgs) => string
}

declare interface SourceMapOptions {
  inline?: PostCssSourceMapOptions["inline"],
  sourcesContent?: PostCssSourceMapOptions["sourcesContent"],
  annotation?: PostCssSourceMapOptions["annotation"],
}

declare interface Options {
  include?: string | string[]
  exclude?: string | string[]
  loaders?: Loader[]
  importCSS?: boolean
  postCssPlugins?: object[]
  classNamePrefix?: string
  scopedName?: string
  customCSSPath?: (id: string) => string
  sourceMap?: boolean | SourceMapOptions
}

declare const onwarn: WarningHandlerWithDefault;

declare const libStylePlugin: PluginImpl<Options>

export { onwarn, libStylePlugin }
