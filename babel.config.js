module.exports = function (api) {
  const isTest = process.env.BABEL_ENV === "test";
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: isTest ? [] : ["react-native-reanimated/plugin"],
  };
};
