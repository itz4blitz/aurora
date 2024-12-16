import * as path from 'path';
import * as webpack from 'webpack';
import TerserPlugin from 'terser-webpack-plugin';

const config: webpack.Configuration = {
  target: 'node',
  mode: 'production',
  entry: './src/extension.ts',
  output: {
    path: path.resolve(__dirname, 'out'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
  },
  externals: {
    vscode: 'commonjs vscode',
  },
  resolve: {
    extensions: ['.ts', '.js'],
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@ui': path.resolve(__dirname, 'src/ui'),
      '@services': path.resolve(__dirname, 'src/services'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@webview': path.resolve(__dirname, 'src/webview'),
      '@config': path.resolve(__dirname, 'src/config'),
      '@error': path.resolve(__dirname, 'src/error'),
      '@types': path.resolve(__dirname, 'src/types'),
      '@commands': path.resolve(__dirname, 'src/commands'),
      '@visualization': path.resolve(__dirname, 'src/visualization'),
      '@status': path.resolve(__dirname, 'src/status'),
      '@sync': path.resolve(__dirname, 'src/sync'),
    },
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
          },
        ],
      },
    ],
  },
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          format: {
            comments: false,
          },
        },
        extractComments: false,
      }),
    ],
  },
  cache: {
    type: 'filesystem',
  },
};

export default config;
