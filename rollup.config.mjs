import { babel } from '@rollup/plugin-babel';

const config = {
  plugins: [babel({ extensions: [".js", ".ts"], babelHelpers: 'bundled' })]
};

export default config
