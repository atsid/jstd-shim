/*
 * A very barebones implementation of the JSTD window environment.
 *
 * Defines some Globals required for running JSTD tests:
 * - TestCase, AsyncTestCase, jstestdriver
 * - Assert.js from the jstd projectcopied and pasted at end for assertion
 *   globals (AssertTrue, AssertBoolean, etc.)
 *
 * Reporter functions:
 *  - result(resultObj)
 *  - complete()
 */

var JSTD_SHIM = (function (global) {
    var suites = [],
        currentSuite,
        testQueue = [],
        Async = function () {},
        default_timeout = 30000, //timeout after 30 secs by default (like jstd)
        timeout_ms,
        stats,
        reporter = Object.create({
            result: function (resultObj) {
                console.log((resultObj.success ? 'SUCCESS' : 'FAIL') + ' ' + resultObj.description);
            },
            success: function (resultObj) {},
            error: function (error, resultObj, name) {
                var message;
                name = name || error.name;
                console.log(name, error);
                if (error.stack) {
                    console.error(error.stack);
                }
            },
            complete: function (stats) {
                console.log("  ****  JSTD SHIM RESULTS: " + (stats.fail > 0 || stats.error > 0 ? 'FAIL' : 'SUCCESS') + "  ****  ");
                console.log(" Ran:     " + stats.total + " in " + (stats.totalTime / 1000).toFixed(3) + " secs");
                console.log(" Passed:  " + stats.pass);
                console.log(" Failed:  " + stats.fail);
                console.log(" Error:   " + stats.error);
                console.log(" Ignored: " + stats.ignore);
            }
        });

    global.TestCase = function (suite_name, tests) {
        var fn = function () {},
            Sync = function () {};
        Sync.prototype = tests;
        fn.prototype = new Sync();
        suites.push({
            tests: fn,
            name: suite_name
        });
        return fn;
    };

    global.AsyncTestCase = function (name) {
        var tempFn = function () {};
        tempFn.prototype = new Async();
        suites.push({
            tests: tempFn,
            name: name
        });
        return tempFn;
    };

    //mock the jsttestdriver object and jQuery where necessary - because of Asserts.js
    global.jstestdriver = {
        assertCount: 0,
        jQuery: {
            isArray: function (obj) {
                return Object.prototype.toString.call(obj) === "[object Array]";
            }
        }
    };

    /**
     * TODO: Need to think about best solution for DOM manipulations
     */
    function cleanUpTestZone() {
        var node = document.body,
            child = node.firstChild;
        while (child) {
            node.removeChild(child);
            child = node.firstChild;
        }
        node.innerHTML = "";
    }

    /*
     * JSTD allowed us to insert things into the DOM with comments:
     *  DOC += <div>something</div>
     *
     *  Since that functionality is gone, we have to toString the fn and replicate that logic here
     */
    function doDOMstuff(fn) {
        var fnString = fn.toString(), //added inside TestCaseOverrides
            pattern = /\/\*:DOC\s\+=([\S\s]+)\*\//g,
            cnt = 0;

        fnString.replace(pattern, function (all, htmlString) { 
            //only support one
            if (!cnt) {
                htmlString = htmlString.replace(/(\r\n?|\n)/g, "");//ignore newlines
                htmlString = htmlString.replace(/^\s+|\s+$/g, '');//trim
                //TODO: For some tags in IE this is buggy
                document.body.innerHTML = htmlString;
            }
            cnt += 1;
        });
    }

    /**
     * A clumsy implementation of JSTD's async test API. This can probably be improved
     */
    function runAsyncTest(test, result) {
        var fns = [],
            suite = currentSuite.tests,
            timeout,
            counter = 0,
            failed = false;
            callbacks = {
                add: function (fn, count) {
                    count = count || 1;

                    if (!counter) {
                        timeout = setTimeout(function () {
                            failed = true;
                            error(new Error("Async Test Timeout: " + currentSuite.name), result);
                        }, timeout_ms || default_timeout);
                    }
                    counter += count;

                    var callback = function callback () {
                        if (!failed) {
                            fn.call();
                            counter -= 1;
                            if (counter <= 0) {
                                clearTimeout(timeout);
                                setTimeout(run, 1);
                            }
                        }
                    };

                    return callback;
                }
            },
            queue = {
                call: function (msg, fn) {
                    fns.push(function () {
                        fn.call({}, callbacks);
                        // necessary to move to next queue.call
                        // if no callbacks are added inside
                        // current queue.call 
                        if (counter <= 0) {
                            setTimeout(run, 1);
                        }
                    });
                }
            },
            run = function () {
                if (fns.length) {
                    try {
                        fns.shift().call({});
                    } catch (e) {
                        error(e, result);
                    }
                } else {
                    runJstdFn("tearDown");
                    successTest(result);
                }
            };
        suite[test](queue); //load fns
        run(); //begin executing callbacks in queue
    }

    function runJstdFn(fnName) {
        var suite = currentSuite.tests;
        if (suite[fnName]) {
            doDOMstuff(suite[fnName]);
            suite[fnName]();
        }
    }

    function testIgnore (fn) {
        return (fn.toString().indexOf("ignore();") > -1);
    }

    function ignoreTest(result) {
        stats.ignore += 1;
        result.skipped = true;
        result.time = 0;
        completeTest(result);
    }

    function successTest(result) {
        stats.pass += 1;
        result.success = true;
        result.time = Date.now() - result.t0;
        reporter.success(result);
        completeTest(result);
    }

    function completeTest(result) {
        reporter.result(result);
        setTimeout(runTest, 1);
    }

    function error(e, result) {
        result.success = false;
        result.time = Date.now() - result.t0;
        if (e.name === "AssertError") {
            stats.fail += 1;
            reporter.error(e, result);
        } else {
            stats.error += 1;
            reporter.error(e, result, "Unexpected Error");
        }
        completeTest(result);
    }

    function runTest() {
        var testName = testQueue.shift(),
            testObject = currentSuite.tests,
            result;

        if (testName) {
            stats.total += 1;
            cleanUpTestZone();
            result = {
                id: stats.total,
                description: testName,
                suite: [],
                log: [],
                t0: Date.now()
            };
            result.suite.unshift(currentSuite.name);
            if (testIgnore(testObject[testName])) {
                ignoreTest(result);
            } else {
                global.globalSetup && globalSetup();
                runJstdFn("setUp");
                if (testObject instanceof Async) {
                    runAsyncTest(testName, result);
                } else {
                    try {
                        runJstdFn(testName);
                        runJstdFn("tearDown");
                        successTest(result);
                    } catch (e) {
                        error(e, result);
                    }
                }
            }
        } else {
            //DONE WITH ALL TESTS FOR THIS SUITE
            runSuite();
        }
    }

    function runSuite() {
        currentSuite = suites.shift();

        if (currentSuite) {
            //push the tests to an array
            testQueue = [];

            //first, instantiate
            if (typeof currentSuite.tests === "function") {
                currentSuite.tests = new currentSuite.tests();
            }
            for (test in currentSuite.tests) if (/^test/.test(test)) {
                testQueue.push(test);
            }
            //START TESTS FOR THIS SUITE
            runTest();
        } else {
            // COMPLETED ALL
            stats.totalTime = Date.now() - stats.t0;
            reporter.complete(stats);
        }
    }

    function getTotal() {
        var cnt = 0,
            temp;
        suites.forEach(function (suite) {
            temp = new suite.tests();
            for (prop in temp) {
                if (/^test/.test(prop)) {
                    cnt += 1;
                }
            }
        });
        return cnt;
    }

    return {
        execute: function() {
            stats = {
                total: 0,
                pass: 0,
                fail: 0,
                error: 0,
                ignore: 0,
                t0: Date.now()
            };
            runSuite();
        },
        reset: function () {
            suites = [];
            timeout_ms = default_timeout;
        },
        modifyReporter: function (modifyFn) {
            reporter = modifyFn(reporter);
        },
        setAsyncTimeout: function (ms) {
            timeout_ms = ms;
        },
        getTotal: function () {
            return getTotal();
        },
        setNoopReporter: function() {
            var noop = function () {};
            reporter = {
                result: noop,
                success: noop,
                error: noop,
                complete: noop
            };
        }
    }

}(this));

//Begin the jstd project's Asserts.js

/*
 * Copyright 2009 Google Inc.
 * 
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not
 * use this file except in compliance with the License. You may obtain a copy of
 * the License at
 * 
 * http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 */
function expectAsserts(count) {
  jstestdriver.expectedAssertCount = count;
}


var fail = function fail(msg) {
  var err = new Error(msg);
  err.name = 'AssertError';

  if (!err.message) {
    err.message = msg;
  }

  throw err;
};


function isBoolean_(bool) {
  if (typeof(bool) != 'boolean') {
    fail('Not a boolean: ' + prettyPrintEntity_(bool));
  }
}


var isElement_ = (function () {
  var div = document.createElement('div');

  function isNode(obj) {
    try {
      div.appendChild(obj);
      div.removeChild(obj);
    } catch (e) {
      return false;
    }

    return true;
  }

  return function isElement(obj) {
    return obj && obj.nodeType === 1 && isNode(obj);
  };
}());


function formatElement_(el) {
  var tagName;

  try {
    tagName = el.tagName.toLowerCase();
    var str = '<' + tagName;
    var attrs = el.attributes, attribute;

    for (var i = 0, l = attrs.length; i < l; i++) {
      attribute = attrs.item(i);

      if (!!attribute.nodeValue) {
        str += ' ' + attribute.nodeName + '=\"' + attribute.nodeValue + '\"';
      }
    }

    return str + '>...</' + tagName + '>';
  } catch (e) {
    return '[Element]' + (!!tagName ? ' ' + tagName : '');
  }
}


function prettyPrintEntity_(entity) {
  if (isElement_(entity)) {
    return formatElement_(entity);
  }

  var str;

  if (typeof entity == 'function') {
    try {
      str = entity.toString().match(/(function [^\(]+\(\))/)[1];
    } catch (e) {}

    return str || '[function]';
  }

  try {
    str = JSON.stringify(entity);
  } catch (e) {}

  return str || '[' + typeof entity + ']';
}


function argsWithOptionalMsg_(args, length) {
  var copyOfArgs = [];
  // make copy because it's bad practice to change a passed in mutable
  // And to ensure we aren't working with an arguments array. IE gets bitchy.
  for(var i = 0; i < args.length; i++) {
    copyOfArgs.push(args[i]);
  }
  var min = length - 1;

  if (args.length < min) {
    fail('expected at least ' + min + ' arguments, got ' + args.length);
  } else if (args.length == length) {
    copyOfArgs[0] += ' ';
  } else {
    copyOfArgs.unshift('');
  }
  return copyOfArgs;
}


function assertTrue(msg, actual) {
  var args = argsWithOptionalMsg_(arguments, 2);
  jstestdriver.assertCount++;

  isBoolean_(args[1]);
  if (args[1] != true) {
    fail(args[0] + 'expected true but was ' + prettyPrintEntity_(args[1]));
  }
  return true;
}


function assertFalse(msg, actual) {
  var args = argsWithOptionalMsg_(arguments, 2);
  jstestdriver.assertCount++;

  isBoolean_(args[1]);
  if (args[1] != false) {
    fail(args[0] + 'expected false but was ' + prettyPrintEntity_(args[1]));
  }
  return true;
}


function assertEquals(msg, expected, actual) {
  var args = argsWithOptionalMsg_(arguments, 3);
  jstestdriver.assertCount++;
  msg = args[0];
  expected = args[1];
  actual = args[2];

  if (!compare_(expected, actual)) {
    fail(msg + 'expected ' + prettyPrintEntity_(expected) + ' but was ' +
        prettyPrintEntity_(actual) + '');
  }
  return true;
}


function compare_(expected, actual) {
  if (expected === actual) {
    return true;
  }

  if (typeof expected != 'object' ||
      typeof actual != 'object' ||
      !expected || !actual) {
    return expected == actual;
  }

  if (isElement_(expected) || isElement_(actual)) {
    return false;
  }

  var key = null;
  var actualLength   = 0;
  var expectedLength = 0;

  try {
    // If an array is expected the length of actual should be simple to
    // determine. If it is not it is undefined.
    if (jstestdriver.jQuery.isArray(actual)) {
      actualLength = actual.length;
    } else {
      // In case it is an object it is a little bit more complicated to
      // get the length.
      for (key in actual) {
        if (actual.hasOwnProperty(key)) {
          ++actualLength;
        }
      }
    }

    // Arguments object
    if (actualLength == 0 && typeof actual.length == 'number') {
      actualLength = actual.length;

      for (var i = 0, l = actualLength; i < l; i++) {
        if (!(i in actual)) {
          actualLength = 0;
          break;
        }
      }
    }

    for (key in expected) {
      if (expected.hasOwnProperty(key)) {
        if (!compare_(expected[key], actual[key])) {
          return false;
        }

        ++expectedLength;
      }
    }

    if (expectedLength != actualLength) {
      return false;
    }

    return expectedLength == 0 ? expected.toString() == actual.toString() : true;
  } catch (e) {
    return false;
  }
}


function assertNotEquals(msg, expected, actual) {
  try {
    assertEquals.apply(this, arguments);
  } catch (e) {
    if (e.name == 'AssertError') {
      return true;
    }

    throw e;
  }

  var args = argsWithOptionalMsg_(arguments, 3);

  fail(args[0] + 'expected ' + prettyPrintEntity_(args[1]) +
      ' not to be equal to ' + prettyPrintEntity_(args[2]));
}


function assertSame(msg, expected, actual) {
  var args = argsWithOptionalMsg_(arguments, 3);
  jstestdriver.assertCount++;

  if (!isSame_(args[2], args[1])) {
    fail(args[0] + 'expected ' + prettyPrintEntity_(args[1]) + ' but was ' +
        prettyPrintEntity_(args[2]));
  }
  return true;
}


function assertNotSame(msg, expected, actual) {
  var args = argsWithOptionalMsg_(arguments, 3);
  jstestdriver.assertCount++;

  if (isSame_(args[2], args[1])) {
    fail(args[0] + 'expected not same as ' + prettyPrintEntity_(args[1]) +
        ' but was ' + prettyPrintEntity_(args[2]));
  }
  return true;
}


function isSame_(expected, actual) {
  return actual === expected;
}


function assertNull(msg, actual) {
  var args = argsWithOptionalMsg_(arguments, 2);
  jstestdriver.assertCount++;

  if (args[1] !== null) {
    fail(args[0] + 'expected null but was ' + prettyPrintEntity_(args[1]));
  }
  return true;
}


function assertNotNull(msg, actual) {
  var args = argsWithOptionalMsg_(arguments, 2);
  jstestdriver.assertCount++;

  if (args[1] === null) {
    fail(args[0] + 'expected not null but was null');
  }

  return true;
}


function assertUndefined(msg, actual) {
  var args = argsWithOptionalMsg_(arguments, 2);
  jstestdriver.assertCount++;

  if (typeof args[1] != 'undefined') {
    fail(args[2] + 'expected undefined but was ' + prettyPrintEntity_(args[1]));
  }
  return true;
}


function assertNotUndefined(msg, actual) {
  var args = argsWithOptionalMsg_(arguments, 2);
  jstestdriver.assertCount++;

  if (typeof args[1] == 'undefined') {
    fail(args[0] + 'expected not undefined but was undefined');
  }
  return true;
}


function assertNaN(msg, actual) {
  var args = argsWithOptionalMsg_(arguments, 2);
  jstestdriver.assertCount++;

  if (!isNaN(args[1])) {
    fail(args[0] + 'expected to be NaN but was ' + args[1]);
  }

  return true;
}


function assertNotNaN(msg, actual) {
  var args = argsWithOptionalMsg_(arguments, 2);
  jstestdriver.assertCount++;

  if (isNaN(args[1])) {
    fail(args[0] + 'expected not to be NaN');
  }

  return true;
}


function assertException(msg, callback, error) {
  if (arguments.length == 1) {
    // assertThrows(callback)
    callback = msg;
    msg = '';
  } else if (arguments.length == 2) {
    if (typeof callback != 'function') {
      // assertThrows(callback, type)
      error = callback;
      callback = msg;
      msg = '';
    } else {
      // assertThrows(msg, callback)
      msg += ' ';
    }
  } else {
    // assertThrows(msg, callback, type)
    msg += ' ';
  }

  jstestdriver.assertCount++;

  try {
    callback();
  } catch(e) {
    if (e.name == 'AssertError') {
      throw e;
    }

    if (error && e.name != error) {
      fail(msg + 'expected to throw ' + error + ' but threw ' + e.name);
    }

    return true;
  }

  fail(msg + 'expected to throw exception');
}


function assertNoException(msg, callback) {
  var args = argsWithOptionalMsg_(arguments, 2);
  jstestdriver.assertCount++;

  try {
    args[1]();
  } catch(e) {
    fail(args[0] + 'expected not to throw exception, but threw ' + e.name +
        ' (' + e.message + ')');
  }
}


function assertArray(msg, actual) {
  var args = argsWithOptionalMsg_(arguments, 2);
  jstestdriver.assertCount++;

  if (!jstestdriver.jQuery.isArray(args[1])) {
    fail(args[0] + 'expected to be array, but was ' +
        prettyPrintEntity_(args[1]));
  }
}


function assertTypeOf(msg, expected, value) {
  var args = argsWithOptionalMsg_(arguments, 3);
  jstestdriver.assertCount++;
  var actual = typeof args[2];

  if (actual != args[1]) {
    fail(args[0] + 'expected to be ' + args[1] + ' but was ' + actual);
  }

  return true;
}


function assertBoolean(msg, actual) {
  var args = argsWithOptionalMsg_(arguments, 2);
  return assertTypeOf(args[0], 'boolean', args[1]);
}


function assertFunction(msg, actual) {
  var args = argsWithOptionalMsg_(arguments, 2);
  return assertTypeOf(args[0], 'function', args[1]);
}


function assertObject(msg, actual) {
  var args = argsWithOptionalMsg_(arguments, 2);
  return assertTypeOf(args[0], 'object', args[1]);
}


function assertNumber(msg, actual) {
  var args = argsWithOptionalMsg_(arguments, 2);
  return assertTypeOf(args[0], 'number', args[1]);
}


function assertString(msg, actual) {
  var args = argsWithOptionalMsg_(arguments, 2);
  return assertTypeOf(args[0], 'string', args[1]);
}


function assertMatch(msg, regexp, actual) {
  var args = argsWithOptionalMsg_(arguments, 3);
  var isUndef = typeof args[2] == 'undefined';
  jstestdriver.assertCount++;
  var _undef;

  if (isUndef || !args[1].test(args[2])) {
    actual = (isUndef ? _undef : prettyPrintEntity_(args[2]));
    fail(args[0] + 'expected ' + actual + ' to match ' + args[1]);
  }

  return true;
}


function assertNoMatch(msg, regexp, actual) {
  var args = argsWithOptionalMsg_(arguments, 3);
  jstestdriver.assertCount++;

  if (args[1].test(args[2])) {
    fail(args[0] + 'expected ' + prettyPrintEntity_(args[2]) +
        ' not to match ' + args[1]);
  }

  return true;
}


function assertTagName(msg, tagName, element) {
  var args = argsWithOptionalMsg_(arguments, 3);
  var actual = args[2] && args[2].tagName;

  if (String(actual).toUpperCase() != args[1].toUpperCase()) {
    fail(args[0] + 'expected tagName to be ' + args[1] + ' but was ' + actual);
  }
  return true;
}


function assertClassName(msg, className, element) {
  var args = argsWithOptionalMsg_(arguments, 3);
  var actual = args[2] && args[2].className;
  var regexp = new RegExp('(^|\\s)' + args[1] + '(\\s|$)');

  try {
    assertMatch(args[0], regexp, actual);
  } catch (e) {
    actual = prettyPrintEntity_(actual);
    fail(args[0] + 'expected class name to include ' +
        prettyPrintEntity_(args[1]) + ' but was ' + actual);
  }

  return true;
}


function assertElementId(msg, id, element) {
  var args = argsWithOptionalMsg_(arguments, 3);
  var actual = args[2] && args[2].id;
  jstestdriver.assertCount++;

  if (actual !== args[1]) {
    fail(args[0] + 'expected id to be ' + args[1] + ' but was ' + actual);
  }

  return true;
}


function assertInstanceOf(msg, constructor, actual) {
  jstestdriver.assertCount++;
  var args = argsWithOptionalMsg_(arguments, 3);
  var pretty = prettyPrintEntity_(args[2]);
  var expected = args[1] && args[1].name || args[1];

  if (args[2] == null) {
    fail(args[0] + 'expected ' + pretty + ' to be instance of ' + expected);
  }

  if (!(Object(args[2]) instanceof args[1])) {
    fail(args[0] + 'expected ' + pretty + ' to be instance of ' + expected);
  }

  return true;
}


function assertNotInstanceOf(msg, constructor, actual) {
  var args = argsWithOptionalMsg_(arguments, 3);
  jstestdriver.assertCount++;

  if (Object(args[2]) instanceof args[1]) {
    var expected = args[1] && args[1].name || args[1];
    var pretty = prettyPrintEntity_(args[2]);
    fail(args[0] + 'expected ' + pretty + ' not to be instance of ' + expected);
  }

  return true;
}

/**
 * Asserts that two doubles, or the elements of two arrays of doubles,
 * are equal to within a positive delta.
 */
function assertEqualsDelta(msg, expected, actual, epsilon) {
  var args = this.argsWithOptionalMsg_(arguments, 4);
  jstestdriver.assertCount++;
  msg = args[0];
  expected = args[1];
  actual = args[2];
  epsilon = args[3];

  if (!compareDelta_(expected, actual, epsilon)) {
    this.fail(msg + 'expected ' + epsilon + ' within ' +
              this.prettyPrintEntity_(expected) +
              ' but was ' + this.prettyPrintEntity_(actual) + '');
  }
  return true;
};

function compareDelta_(expected, actual, epsilon) {
  var compareDouble = function(e,a,d) {
    return Math.abs(e - a) <= d;
  }
  if (expected === actual) {
    return true;
  }

  if (typeof expected == "number" ||
      typeof actual == "number" ||
      !expected || !actual) {
    return compareDouble(expected, actual, epsilon);
  }

  if (isElement_(expected) || isElement_(actual)) {
    return false;
  }

  var key = null;
  var actualLength   = 0;
  var expectedLength = 0;

  try {
    // If an array is expected the length of actual should be simple to
    // determine. If it is not it is undefined.
    if (jstestdriver.jQuery.isArray(actual)) {
      actualLength = actual.length;
    } else {
      // In case it is an object it is a little bit more complicated to
      // get the length.
      for (key in actual) {
        if (actual.hasOwnProperty(key)) {
          ++actualLength;
        }
      }
    }

    // Arguments object
    if (actualLength == 0 && typeof actual.length == "number") {
      actualLength = actual.length;

      for (var i = 0, l = actualLength; i < l; i++) {
        if (!(i in actual)) {
          actualLength = 0;
          break;
        }
      }
    }

    for (key in expected) {
      if (expected.hasOwnProperty(key)) {
        if (!compareDelta_(expected[key], actual[key], epsilon)) {
          return false;
        }

        ++expectedLength;
      }
    }

    if (expectedLength != actualLength) {
      return false;
    }

    return expectedLength == 0 ? expected.toString() == actual.toString() : true;
  } catch (e) {
    return false;
  }
};

var assert = assertTrue;
