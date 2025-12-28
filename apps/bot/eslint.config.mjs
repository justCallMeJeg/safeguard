import rootConfig from "../../eslint.config.mjs";

export default [
  ...rootConfig,
  {
    languageOptions: {
      globals: {
        Bun: "readonly",
        process: "readonly",
        console: "readonly",
      },
    },
  },
];
