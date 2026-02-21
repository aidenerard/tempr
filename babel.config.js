module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      [
        "module-resolver",
        {
          root: ["./"],
          alias: {
            "@": "./src",
            "@components": "./src/components",
            "@services": "./src/services",
            "@hooks": "./src/hooks",
            "@lib": "./src/lib",
            "@store": "./src/store",
            "@types": "./src/types",
            "@constants": "./src/constants",
          },
        },
      ],
      "react-native-reanimated/plugin",
    ],
  };
};
