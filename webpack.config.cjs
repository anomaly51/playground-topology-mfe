const webpack = require("webpack");
const { merge } = require("webpack-merge");
const singleSpaDefaults = require("webpack-config-single-spa-react-ts");

module.exports = (webpackConfigEnv = {}, argv = {}) => {
  const defaultConfig = singleSpaDefaults({
    orgName: "lab",
    projectName: "topology-mfe",
    webpackConfigEnv,
    argv,
    outputSystemJS: true,
    disableHtmlGeneration: true,
  });

  return merge(defaultConfig, {
    devServer: {
      host: "0.0.0.0",
      port: 5174,
      allowedHosts: "all",
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    },
    plugins: [
      new webpack.DefinePlugin({
        __ENABLE_TOOL_LINKS__: process.env.VITE_ENABLE_TOOL_LINKS !== "false",
        __EVENTS_BASE_URL__: JSON.stringify(
          process.env.VITE_EVENTS_BASE_URL || "http://localhost:3003",
        ),
      }),
    ],
  });
};
