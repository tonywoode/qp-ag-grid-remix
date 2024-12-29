/** @type {import("@remix-run/dev").AppConfig} */
module.exports = {
  //for remix utils v7
  serverDependenciesToBundle: [/^remix-utils.*/, /^remember.*/],
  ignoredRouteFiles: ['**/.*'],
  // appDirectory: "app",
  // assetsBuildDirectory: "public/build",
  // publicPath: "/build/",
  // serverBuildPath: "build/index.js",
  serverModuleFormat: 'cjs',
  browserNodeBuiltinsPolyfill: { modules: { util: true } }
}
