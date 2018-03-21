// @flow
'use strict';

const _ = require('lodash');
const webpack = require('webpack');
const path = require('path');
const chalk = require('chalk');
const webpackMerge = require('webpack-merge');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const prettyMs = require('pretty-ms');
const errorTypes = require('./error-types');
const wrapError = require('./wrap-error');
const constants = require('./constants');
const createWebpackConfigClient = require('./create-webpack-config-client');
const createWebpackStatsError = require('./create-webpack-stats-error');
const watchContext = require('./watch-context');
const writeWebpackStats = require('./write-webpack-stats');

function watchWebpack(
  batfishConfig: BatfishConfiguration,
  options: {
    onError: Error => void,
    onNotification: string => void,
    onFirstCompile: () => void
  }
): void {
  const { onError, onNotification, onFirstCompile } = options;

  const htmlWebpackPluginOptions = {
    template: path.join(__dirname, '../webpack/html-webpack-template.ejs'),
    cssBasename: _.isEmpty(batfishConfig.stylesheets)
      ? ''
      : constants.BATFISH_CSS_BASENAME
  };
  let lastHash;
  let hasCompiled = false;

  createWebpackConfigClient(batfishConfig, {
    devServer: true
  })
    .then(clientConfig => {
      // Create an HTML file to load the assets in the browser.
      const config = webpackMerge(clientConfig, {
        plugins: [new HtmlWebpackPlugin(htmlWebpackPluginOptions)]
      });

      let compiler;
      try {
        compiler = webpack(config);
      } catch (compilerInitializationError) {
        onError(
          wrapError(compilerInitializationError, errorTypes.WebpackFatalError)
        );
        return;
      }

      const onCompilation = (compilationError, stats) => {
        // Don't do anything if the compilation is just repetition.
        // There's often a series of many compilations with the same output.
        if (stats.hash === lastHash) return;
        lastHash = stats.hash;

        if (!hasCompiled) {
          hasCompiled = true;
          onNotification(chalk.green.bold('Go!'));
          if (onFirstCompile) {
            onFirstCompile();
          }
        }

        if (compilationError) {
          onError(
            wrapError(compilationError, errorTypes.WebpackCompilationError)
          );
          return;
        }

        if (stats.hasErrors()) {
          onError(createWebpackStatsError(stats));
        }

        writeWebpackStats(batfishConfig.outputDirectory, stats).catch(onError);
        if (batfishConfig.verbose) {
          onNotification(
            stats.toString({
              chunks: false,
              colors: true
            })
          );
        }
        const timing =
          stats.endTime && stats.startTime
            ? ` in ${prettyMs(stats.endTime - stats.startTime)}`
            : '';
        onNotification(`Webpack compiled${timing}.`);
      };

      compiler.watch(
        {
          ignored: [
            /node_modules/,
            // Ignore page files because they are watched by watchContext.
            path.join(
              batfishConfig.pagesDirectory,
              `./**/*.${constants.PAGE_EXT_GLOB}`
            ),
            // Ignore temporary files because they are only re-generated by
            // watchContext, and we don't want to double-compile.
            path.join(batfishConfig.temporaryDirectory, './**/*')
          ]
        },
        onCompilation
      );

      // Watch pages separately, so we can rewrite the context module, which
      // will capture changes to front matter, page additions and deletions.
      watchContext(batfishConfig, {
        onError: onError,
        afterCompilation: () => {
          compiler.run(onCompilation);
        }
      });
    })
    .catch(onError);
}

module.exports = watchWebpack;
