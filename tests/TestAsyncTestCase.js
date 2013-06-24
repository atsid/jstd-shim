describe("AsyncTestCase Suite", function () {

    beforeEach(function (){
        JSTD_SHIM.reset();
        JSTD_SHIM.modifyReporter(function (oldReporter) {
            return {
                result: function () {},
                error: function () {},
                complete: function () {}
            };
        });
    });

    it("executes functions synchronously", function() {
        var QueueTest = new AsyncTestCase('QueueTest'),
            str = "";

        QueueTest.prototype.testSomething = function(queue) {
            var state = 0;

            queue.call('Add a', function() {
                str += "a";
            });

            queue.call('Add b', function() {
                str += "b";
            });

            queue.call('Add c', function() {
                str += "c"
            });
        };

        JSTD_SHIM.execute();
        waits(100);

        runs(function () {
            expect(str).toBe("abc");
        });

    });

    it("executes basic timeout", function () {
        var TimeoutTest = new AsyncTestCase('TimeoutTest'),
            result,
            state = 0;

        TimeoutTest.prototype.testTimeout = function(queue) {
            queue.call('Step 1: schedule the window to increment our variable 5 seconds from now.', function(callbacks) {
                var myCallback = callbacks.add(function() {
                    state = 1;
                });
                window.setTimeout(myCallback, 1000);
            });

            queue.call('Step 2: then assert our state variable changed', function() {
                if (state === 1) {
                    result = true;
                }
            });
        }

        JSTD_SHIM.execute();
        waits(1500);
        runs(function () {
            expect(result).toBe(true);
        });
    });

    it("handles multiple invocations", function () {
        var MultipleTest = AsyncTestCase('MultipleTest'),
            count = 0;

        MultipleTest.prototype.testMultipleInvocations = function(queue) {
            queue.call('Expect three invocations', function(callbacks) {
                var intervalHandle,
                    callback = callbacks.add(function() {
                        count += 1;
                        if (count >= 3) {
                            window.clearInterval(intervalHandle);
                        }
                    }, 3); // expect callback to be called no less than 3 times
                intervalHandle = window.setInterval(callback, 500);
            });

            queue.call('Test it', function () {
                expect(count).toBe(3);
                count += 1;
            });
        };

        JSTD_SHIM.execute();

        waits(2000);

        runs(function () {
            expect(count).toBe(4);
        });
    });

    it("works with Test Case", function() {
        var QueueTest = new AsyncTestCase('QueueTest'),
            str = "",
            TestTwo,
            invokedOne = false,
            invokedTwo = false,
            Test = new TestCase('Basic Test', {
                testSomething: function () {
                    invokedOne = true;
                }
            });

        QueueTest.prototype.testSomething = function(queue) {
            var state = 0;

            queue.call('Add a', function() {
                str += "a";
            });

            queue.call('Add b', function() {
                str += "b";
            });

            queue.call('Add c', function() {
                str += "c"
            });
        };

        TestTwo = new TestCase('Basic Test Two', {
            testSomething: function () {
                invokedTwo = true;
            }
        });

        expect(JSTD_SHIM.getTotal()).toBe(3);

        JSTD_SHIM.execute();
        waits(100);

        runs(function () {
            expect(invokedOne).toBe(true);
            expect(str).toBe("abc");
            expect(invokedTwo).toBe(true);
        });

    });

    it("fails after test timeout", function () {
        var AsyncTimeoutTest = new AsyncTestCase('AsyncTimeoutTest'),
            state = 0;

        AsyncTimeoutTest.prototype.testTimeout = function(queue) {
            queue.call('Setup callback that will timeout', function(callbacks) {
                var myCallback = callbacks.add(function() {
                    state = 1;
                });
                window.setTimeout(myCallback, 2000);
            });
        }

        JSTD_SHIM.setAsyncTimeout(1000);
        JSTD_SHIM.execute();
        waits(2500);
        runs(function () {
            expect(state).toBe(0);
        });
    });
});
