import babel from "@rollup/plugin-babel";
import typescript from "rollup-plugin-typescript2";
import { uglify } from "rollup-plugin-uglify";

export default {
  input: "src/main.ts",
  output: {
    exports: "auto",
    file: "lib/mark-image.min.js",
    format: "umd",
    name: "MarkImage",
  },
  plugins: [typescript(), babel({ babelHelpers: "bundled" }), uglify()],
};
