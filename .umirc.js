var path = require('path');
var CompressionPlugin = require('compression-webpack-plugin');
var env = process.env.QA_ENV;
const cesiumSource = 'node_modules/cesium/Source';
const cesiumWorkers = '../Build/Cesium/Workers';

function getPlugins() {
  if (env === 'build') {
    return {
      install: {
        plugin: require('uglifyjs-webpack-plugin'),
        args: [
          {
            sourceMap: false,
            uglifyOptions: {
              compress: {
                // 删除所有的 `console` 语句
                drop_console: true,
              },
              output: {
                // 最紧凑的输出
                beautify: false,
                // 删除所有的注释
                comments: false,
              },
            },
          },
        ],
      },
    };
  } else {
    return {};
  }
}

function getModulePackageName(module) {
  if (!module.context) return null;
  const nodeModulesPath = path.join(__dirname, './node_modules/');
  if (module.context.substring(0, nodeModulesPath.length) !== nodeModulesPath) {
    return null;
  }
  const moduleRelativePath = module.context.substring(nodeModulesPath.length);
  const [moduleDirName] = moduleRelativePath.split(path.sep);
  let packageName = moduleDirName;
  // handle tree shaking
  if (packageName.match('^_')) {
    // eslint-disable-next-line prefer-destructuring
    packageName = packageName.match(/^_(@?[^@]+)/)[1];
  }
  if (packageName.match(/cesium/)) {
    // eslint-disable-next-line prefer-destructuring
    packageName = 'cesium';
  }
  if (packageName.match(/jsoneditor|brace/)) {
    // eslint-disable-next-line prefer-destructuring
    packageName = 'jsoneditor';
  }
  return packageName;
}

// ref: https://umijs.org/config/
export default {
  // treeShaking: true,
  define: {
    CESIUM_BASE_URL: '/cesium',
  },
  routes: [
    {
      path: '/',
      component: '../layouts/index',
      routes: [
        { path: '/', component: '../pages/index' }
      ]
    }
  ],
  plugins: [
    // ref: https://umijs.org/plugin/umi-plugin-react.html
    ['umi-plugin-react', {
      antd: true,
      dva: true,
      dynamicImport: { webpackChunkName: true },
      title: 'react-3D-Wind',
      dll: false,
      locale: {
        enable: true,
        default: 'en-US',
      },
      routes: {
        exclude: [
          /models\//,
          /services\//,
          /model\.(t|j)sx?$/,
          /service\.(t|j)sx?$/,
          /components\//,
        ],
      },
    }],
  ],
  publicPath: '/',
  alias: {
    'cesium': path.resolve(__dirname, './node_modules/cesium/Source'),
    '@components': path.resolve(__dirname, './src/components'),
    '@utils': path.resolve(__dirname, './src/utils'),
    '@images': path.resolve(__dirname, './src/assets/images'),
    '@services': path.resolve(__dirname, './src/services'),
    '@config': path.resolve(__dirname, './src/assets/config'),
  },
  'copy': [
    {
      from: path.join(cesiumSource, cesiumWorkers), to: 'cesium/Workers',
    },
    {
      from: path.join(cesiumSource, 'Assets'), to: 'cesium/Assets',
    },
    {
      from: path.join(cesiumSource, 'Widgets'), to: 'cesium/Widgets',
    },
  ],
  chainWebpack(config, { webpack }) {
    config.merge({
      amd: {
        toUrlUndefined: true,
      },
      node: {
        fs: 'empty',
      },
      module: {
        unknownContextCritical: false,
      },
      plugin: getPlugins(),
    });

    if (env === 'build') {
      config.optimization
        .runtimeChunk(false) // share the same chunks across different modules
        .splitChunks({
          chunks: 'async',
          name: 'vendors',
          maxInitialRequests: Infinity,
          minSize: 0,
          cacheGroups: {
            vendors: {
              test: module => {
                const packageName = getModulePackageName(module);
                if (packageName) {
                  return ['cesium', 'jsoneditor'].indexOf(packageName) >= 0;
                }
                return false;
              },
              name(module) {
                const packageName = getModulePackageName(module);
                if (['cesium'].indexOf(packageName) >= 0) {
                  return 'cesium'; // visualization package
                }
                if (['jsoneditor'].indexOf(packageName) >= 0) {
                  return 'jsoneditor'; // visualization package
                }
                return 'misc';
              },
            },
          },
        });
      config.plugin('compression').use(
        new CompressionPlugin({
          test: /\.(js|css)(\?.*)?$/i,
          filename: '[path].gz[query]',
          algorithm: 'gzip',
        }),
      );
    }
  }
}
