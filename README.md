JSTD shim
==========

Execute [jstd](https://code.google.com/p/js-test-driver/) tests in your test runner of choice (for example, [Karma](http://karma-runner.github.io/0.8/index.html)). jstd.shim.js attempts to replicate the jstd window environment and its API (functions such as `TestCase` and `AsyncTestCase`) so that a project can continue to run existing jstd tests while moving and/or migrating to another test framework (such as [Jasmine](https://github.com/pivotal/jasmine))

General Use
------------

Include the `jstd.shim.js` file in the window before including/injecting jstd test files. The file will define a global called `JSTD_SHIM` which can be used after jstd test files have loaded to execute the tests: `JSTD_SHIM.execute()`

Reporter
----------

### Default

By default JSTD_SHIM outputs general test result information to the console. The following code defines the default reporter object.

```
reporter = Object.create({
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

In order to adapt the code to other uses the JSTD_SHIM global provides a method to intercept test events by modifying reporter functions.

```
JSTD_SHIM.modifyReporter(function (defaultReporter) {
    defaultReporter.success = function (resultObj) {
        console.log("A test passed! Description: " resultObj.description);
    }
});
```

Use with Karma/Jasmine
----------------------

In `karma.conf.js`, include the `jstd.shim.js` and `jstdshim-jasmine-karma.js` file after jasmine has been loaded in the files array:

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

