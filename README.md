JSTD shim
==========

Execute [jstd](https://code.google.com/p/js-test-driver/) tests in your test runner of choice (for example, [Karma](http://karma-runner.github.io/0.8/index.html)). This project attempts to replicate the jstd window environment and its API (functions such as `TestCase` and `AsyncTestCase`) so that a project can continue to run existing jstd tests while migrating to other test runners and libraries.

General Use
------------

Include the `jstd.shim.js` file in the window before including/injecting jstd test files. The file will define a global called `JSTD_SHIM` which can be used after jstd test files have loaded to execute the tests with `JSTD_SHIM.execute()`. It will also define global functions that exist in the jstd environment (TestCase, AsyncTestCase, asserts, etc.).

Reporter
----------

### Default

By default JSTD_SHIM outputs general test result information to the console. The following code implements the default reporter object inside jstd.shim.js:

```
var reporter = Object.create({
    // test pass
    success: function (resultObj) {},
    // test fail
    error: function (error, resultObj, name) {
        var message;
        name = name || error.name;
        console.log(name, error);
        if (error.stack) {
            console.error(error.stack);
        }
    },
    // occurs after a success OR error
    result: function (resultObj) {
        console.log((resultObj.success ? 'SUCCESS' : 'FAIL') + ' ' + resultObj.description);
    },
    // occurs on test complete
    complete: function (stats) {
        console.log("  ****  JSTD SHIM RESULTS: " + (stats.fail > 0 || stats.error > 0 ? 'FAIL' : 'SUCCESS') + "  ****  ");
        console.log(" Ran:     " + stats.total + " in " + (stats.totalTime / 1000).toFixed(3) + " secs");
        console.log(" Passed:  " + stats.pass);
        console.log(" Failed:  " + stats.fail);
        console.log(" Error:   " + stats.error);
        console.log(" Ignored: " + stats.ignore);
    }
});
```

### Overriding

In order to adapt the code to other uses the JSTD_SHIM global provides a method to override the default functions of the reporter.

```
JSTD_SHIM.modifyReporter(function (defaultReporter) {
    // return modified reporter
    return defaultReporter.success = function (resultObj) {
        console.log("A test passed! Description: " resultObj.description);
    }
});
```

Use with Karma/Jasmine
----------------------

In `karma.conf.js`, include the `jstd.shim.js` and `jstdshim-jasmine-karma.js` files after jasmine has been loaded in the files array:

```
files = [
    JASMINE,
    JASMINE_ADAPTER,
    'jstd.shim.js',
    'adapters/jstdshim-jasmine-karma.js',
    'some-jstd-tests/**/*.js'
]
```

Contributing
-------------

### Running Tests

Test changes to jstd.shim.js after installing Karma (e.g. `npm install`) from the command line with `karma start`.

Changes
-----------

* 0.1.0 - Initial release
* 0.1.1 - Noop reporter, package.json updates, doc refinement
* 0.1.2 - jstdshim-jasmine-karma adapter fix
* 0.1.3 - fixed async bug where successful tests were getting completed twice
