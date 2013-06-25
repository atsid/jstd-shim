describe("TestTestCase Suite", function () {

    beforeEach(function (){
        JSTD_SHIM.reset();
        JSTD_SHIM.setNoopReporter();
    });

    it("executes basic functions properly", function() {
        var setUpInvoked = false,
            testInvoked = false,
            testProtoInvoked = false,
            tearDownInvoked = false,
            Test = new TestCase('Basic Asserts', {
                testBasicAssert: function () {
                    testInvoked = true;
                },
                setUp: function () {
                    setUpInvoked = true;
                },
                tearDown: function () {
                    tearDownInvoked = true;
                }
            });

        Test.prototype.testProto = function () {
            testProtoInvoked = true;
        };

        JSTD_SHIM.execute();

        waits(100);
        runs(function () {
            expect(setUpInvoked).toBe(true);
            expect(testInvoked).toBe(true);
            expect(testProtoInvoked).toBe(true);
            expect(tearDownInvoked).toBe(true);
        });

    });

});
