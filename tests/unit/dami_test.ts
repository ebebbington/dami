import { deferred, Rhum } from "../deps.ts";
import { DAMI } from "../../src/dami.ts";
import { ami, auth } from "../utils.ts";

Rhum.testPlan("tests/unit/dami_test.ts", () => {
  Rhum.testSuite("close()", () => {
    Rhum.testCase("Closes the connection", async () => {
      const Dami = new DAMI(ami);
      await Dami.connect(auth);
      Dami.close();
    });
  });
  Rhum.testSuite("connect()", () => {
    Rhum.testCase("Throws an error when `conn` is already set", async () => {
      const expectedErr = {
        msg: "",
        thrown: true,
      };
      const Dami = new DAMI(ami);
      await Dami.connect(auth);
      try {
        await Dami.connect(auth);
      } catch (err) {
        expectedErr.msg = err.message;
        expectedErr.thrown = true;
      }
      Rhum.asserts.assertEquals(expectedErr, {
        msg: "A connection has already been made",
        thrown: true,
      });
      Dami.close();
    });
    Rhum.testCase("Successfully connects and logs in to the AMI", async () => {
      const Dami = new DAMI(ami);
      await Dami.connect(auth);
      Dami.close();
    });
  });
  Rhum.testSuite("to()", () => {
    Rhum.testCase("Sends an event", async () => {
      const Dami = new DAMI(ami);
      await Dami.connect(auth);
      const promise = deferred();
      let gotMsg = false;
      await Dami.to("GetConfig", { ActionID: 12 }, (data) => {
        gotMsg = true;
        promise.resolve();
      });
      await promise;
      Rhum.asserts.assertEquals(gotMsg, true);
      Dami.close();
    });
  });
  Rhum.testSuite("on()", () => {
    // TODO(edward) Test case is leaking async ops
    Rhum.testCase(
      "Registers a listener",
      async () => {
        const Dami = new DAMI(ami);
        const promise = deferred();
        Dami.on("FullyBooted", (data) => {
          promise.resolve();
        });
        await Dami.connect(auth);
        await promise;
        Dami.close();
      },
    );
  });
});

Rhum.run();
