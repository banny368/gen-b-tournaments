import coreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [".next/**", "node_modules/**", "next-env.d.ts", ".swc-cache/**"],
  },
  ...coreWebVitals,
  ...nextTypescript,
];

export default eslintConfig;
