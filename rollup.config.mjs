import Path from "node:path";
import { fileURLToPath } from "node:url";

import { babel } from '@rollup/plugin-babel';

const config = {
  plugins: [ 
    babel({ 
      extensions: [".js", ".ts"],
      babelHelpers: 'bundled',
      configFile: Path.resolve(Path.dirname(fileURLToPath(import.meta.url)), 'babel.config.js')
    })
  ]
};

export default config
