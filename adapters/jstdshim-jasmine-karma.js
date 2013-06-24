/*
 * This file defines an adapter for the JSTD shim and modifies the Jasmine adapter 
 * so they'll properly report results in Karma
 * IMPORTANT: This must be loaded after the JASMINE_ADAPTER!
 */

(function (karma) {
    var createStartFn = function (executeJasmineTests) {
        return function () {
            var jstdShim = window.JSTD_SHIM,
                jasmineEnv = window.jasmine.getEnv(),
                jasmineReporter,
                //TODO: better way of getting Jasmine total ...
                jasmineTotal = jasmineEnv.nextSpecId_;

            /*
             * Overwrite function responsible for setting total in Jasmine (set via JASMINE_ADAPTER)
             * See: https://github.com/karma-runner/karma-jasmine/
             */
            jasmineEnv.reporter.reportRunnerStarting = function () {};

            // Set total
            karma.info({total: jasmineTotal + JSTD_SHIM.getTotal()});

            /*
             * Define JSTD_SHIM reporter for Karma
             */
            JSTD_SHIM.modifyReporter(function (oldReporter) {
                return {
                    result: function (resultObj) {
                        karma.result(resultObj);
                    },
                    error: function (error, resultObj, name) {
                        var stack = error.stack,
                            message = error.message,
                            firstLine;
                        oldReporter.error(error, resultObj, name);
                        if (stack) {
                            firstLine = stack.substring(0, stack.indexOf('\n') - 1);
                            if (message && message.indexOf(firstLine) === -1) {
                                message = message + '\n' + stack;
                            }
                            //replace jstd.shim stack entries
                            message = message.replace(/\n.+jstd\.shim\.js\?*\d*\:.+(?=(\n|$))/g, '');
                        }
                        resultObj.log.push(message);
                    },
                    complete: function (stats) {
                        oldReporter.complete(stats);
                        console.log('  ****  JASMINE ****  ');
                        console.log(' Total: ' + jasmineTotal);
                        executeJasmineTests(); //let JASMINE_ADAPTER invoke karma.complete
                    }
                };
            });

            /**
             * Execute the tests
             */
            JSTD_SHIM.execute();
        };
    };

    karma.start = createStartFn(karma.start);

}(window.__karma__));

