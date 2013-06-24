JSTD shim
==========

Execute [jstd](https://code.google.com/p/js-test-driver/) tests in your test runner of choice (for example, [Karma](http://karma-runner.github.io/0.8/index.html)). jstd.shim.js attempts to replicate the jstd window environment and its API (functions such as `TestCase` and `AsyncTestCase`) so that a project can continue to run existing jstd tests while moving and/or migrating to another test framework (such as [Jasmine](https://github.com/pivotal/jasmine))

General Use
------------

Include the `jstd.shim.js` file in the window before including/injecting jstd test files. The file will define a global called `JSTD_SHIM` which can be used after jstd test files have loaded to execute the tests: `JSTD_SHIM.execute()`

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

Test changes to jstd.shim.js after installing Karma (e.g. `npm install`) from the command line:

`karma start`
