import postcss from "postcss"
import postcssModules from "postcss-modules"
import {replaceFormat, normalizeClassName} from "./functions.js"

const DEFAULT_SCOPED_NAME = "[local]_[hash:hex:6]"

/**
 * @typedef {object} postCssLoaderOptions
 * @property {object} map
 * @property {object[]} postCssPlugins
 * @property {string} classNamePrefix
 * @property {string} scopedName
 */

/**
 * @typedef {object} postCssLoaderProps
 * @property {postCssLoaderOptions} options
 * @property {string} filePath
 * @property {string} code
 */

/**
 * Transform CSS into CSS-modules
 * @param {postCssLoaderProps}
 * @returns
 */
const postCssLoader = async ({code, filePath, targetPath, options}) => {
  const {scopedName = DEFAULT_SCOPED_NAME, postCssPlugins = [], classNamePrefix = "", map} = options

  const modulesExported = {}

  const isGlobalStyle = /\.global\.(css|scss|sass|less|stylus)$/.test(filePath)
  const isInNodeModules = /[\\/]node_modules[\\/]/.test(filePath)

  const postCssPluginsWithCssModules = [
    postcssModules({
      generateScopedName: (name, filename, css) => {
        const hashContent = `${filename}:${name}:${css}`
        const rawScopedName = replaceFormat(scopedName, name, hashContent)
        const normalizedName = normalizeClassName(rawScopedName)
        return isInNodeModules || isGlobalStyle
          ? name // Use the original name for global or node_modules styles
          : classNamePrefix + normalizedName // Apply prefix and normalize
      },
      getJSON: (cssFileName, json) => (modulesExported[cssFileName] = json),
    }),
    ...postCssPlugins,
  ]

  const postcssOptions = {
    from: filePath,
    to: targetPath,
    map: map,
  }

  const result = await postcss(postCssPluginsWithCssModules).process(code, postcssOptions)

  // collect dependencies
  const dependencies = []
  for (const message of result.messages) {
    if (message.type === "dependency") {
      dependencies.push(message.file)
    }
  }

  // print postcss warnings
  for (const warning of result.warnings()) {
    console.warn(`WARNING: ${warning.plugin}:`, warning.text)
  }

  const moduleCode = `export default ${JSON.stringify(modulesExported[filePath])};`

  return {
    code: moduleCode,
    dependencies,
    extracted: {
      id: filePath,
      css: result.css,
      map: result.map,
    },
  }
}

export default postCssLoader
