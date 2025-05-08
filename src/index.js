import {createFilter} from "rollup-pluginutils"
import postCssTransformer from "./postCssTransformer.js"
import Path from "node:path"

import {mm} from "./sourcemap.ts";

const PLUGIN_NAME = "rollup-plugin-lib-style"
const MAGIC_PATH = "@@_MAGIC_PATH_@@"

const modulesIds = new Set()

const outputPaths = []

const defaultLoaders = [
  {
    name: "css",
    regex: /\.(css)$/,
    process: ({code}) => ({code}),
  },
]

const libStylePlugin = (options = {}) => {
  const {customCSSPath, loaders, include, exclude, importCSS = true, sourceMap = true, sassOptions = {}, ...postCssOptions} = options

  const allLoaders = [...(loaders || []), ...defaultLoaders]
  const filter = createFilter(include, exclude)
  const getLoader = (filepath) => allLoaders.find((loader) => filepath.match(loader.regex))
  let sourceMapOptions = sourceMap !== false ? {inline: true, sourcesContent: true, annotation: true, ...(sourceMap === true ? {} : sourceMap)} : false
  const state = {
    stylesheets: {},
  }

  return {
    name: PLUGIN_NAME,

    outputOptions(options) {
      if (!options.output) console.error("missing output options")
      else options.output.forEach((outputOptions) => outputPaths.push(outputOptions.dir))
    },

    async transform(code, id) {
      const loader = getLoader(id)
      if (!filter(id) || !loader) return null

      modulesIds.add(id)

      const rawCss = await loader.process({filePath: id, code, options: {sassOptions}})
      const codeOrStr = typeof rawCss === "string" ? code : rawCss.code

      if (sourceMapOptions !== false) {
        if (sourceMapOptions.sourcesContent) {
          sourceMapOptions.prev = this.getCombinedSourcemap()
        }
        // It's easier to do that, than to ensure correct path gets generated
        if (!sourceMapOptions.inline) {
          sourceMapOptions.annotation = false
        }

        postCssOptions.map = sourceMapOptions
      }

      const getFilePath = () => {
        return id.replace(process.cwd(), "").replace(/\\/g, "/")
      }

      const cssFilePath = customCSSPath ? customCSSPath(id) : getFilePath()
      const cssFilePathWithoutSlash = cssFilePath.startsWith("/") ? cssFilePath.substring(1) : cssFilePath
      const stylesFileFilename = cssFilePathWithoutSlash.replace(loader.regex, ".css")
      const targetPath = "dist/" + stylesFileFilename

      const postCssResult = await postCssTransformer({code: codeOrStr, filePath: id, targetPath, options: postCssOptions})

      for (const dependency of postCssResult.dependencies) this.addWatchFile(dependency)

      // create a new css file with the generated hash class names
      state.stylesheets[id] = {
        sourceId: id,
        targetPath: stylesFileFilename,
        result: postCssResult,
      }

      const importStr = importCSS ? `import "${MAGIC_PATH}${id}";\n` : ""

      return {
        code: importStr + postCssResult.code,
        map: {mappings: ""},
      }
    },

    generateBundle(outputOptions, bundle) {
      const {dir, preserveModulesRoot} = outputOptions;

      for (const id in state.stylesheets) {
        const stylesheet = state.stylesheets[id]
        const result = stylesheet.result

        const sourceMap = result.extracted.map
        const sourceMapJson = sourceMap.toJSON()
        const mapFileName = stylesheet.targetPath + ".map"
        const map = mm(sourceMapJson).relative(Path.join(dir, Path.dirname(mapFileName)))

        const mapFileId = this.emitFile({
          type: "asset",
          fileName: mapFileName,
          source: map.toString(),
        })

        const cssFileId = this.emitFile({
          type: "asset",
          fileName: stylesheet.targetPath,
          originalFileName: id,
        })

        const importer = bundle[Path.relative(preserveModulesRoot, id) + ".js"]

        const cssPath = Path.join(dir, this.getFileName(cssFileId))
        const mapPath = Path.join(dir, this.getFileName(mapFileId))
        const mappingPath = Path.relative(Path.dirname(cssPath), mapPath);
        const importPath = Path.relative(Path.dirname(Path.join(dir, importer.fileName)), cssPath);

        let cssCode = result.extracted.css

        cssCode += `\n/*# sourceMappingURL=${mappingPath}*/\n`
        importer.code = importer.code.replace(`import '@@_MAGIC_PATH_@@${id}'`, `import './${importPath}'`)

        this.setAssetSource(cssFileId, cssCode)
      }
    },
  }
}

const onwarn = (warning, warn) => {
  if (warning.code === "UNRESOLVED_IMPORT" && warning.message.includes(MAGIC_PATH)) return
  if (typeof warn === "function") warn(warning)
}

export {libStylePlugin, onwarn}
