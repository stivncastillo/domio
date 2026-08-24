// Flat config (ESLint 9+), basado en la config oficial de Expo.
const expoConfig = require("eslint-config-expo/flat");

module.exports = [
  ...expoConfig,
  {
    ignores: ["dist/*", ".expo/*"],
  },
];
