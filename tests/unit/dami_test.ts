import { deferred, Rhum } from "../deps.ts";
import { DAMI } from "../../src/dami.ts";
import { ami, auth } from "../utils.ts";

Rhum.testPlan("tests/unit/dami_test.ts", () => {
  Rhum.testSuite("close()", () => {
    Rhum.testCase("Closes the connection", async () => {
      const Dami = new DAMI(ami);
      await Dami.connectAndLogin(auth);
      Dami.close();
    });
  });
  Rhum.testSuite("connectAndLogin()", () => {
    Rhum.testCase("Throws an error when `conn` is already set", async () => {
      const expectedErr = {
        msg: "",
        thrown: true,
      };
      const Dami = new DAMI(ami);
      await Dami.connectAndLogin(auth);
      try {
        await Dami.connectAndLogin(auth);
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
      await Dami.connectAndLogin(auth);
      Dami.close();
    });
  });
  Rhum.testSuite("to()", () => {
    Rhum.testCase("Sends an event", () => {
      // const Dami = new DAMI(ami);
      // await Dami.connectAndLogin(auth);
      // await Dami.listen();
      // await Dami.to("GetConfig", { ActionID: 12 });
      // Dami.close();
    });
  });
  Rhum.testSuite("on()", () => {
    // TODO(edward) Test case is leaking async ops
    // Rhum.testCase(
    //   "Registers a listener",
    //   async () => {
    //     let e: any;
    //     const Dami = new DAMI(ami);
    //     Dami.on("FullyBooted", (data) => {
    //       e = data
    //     });
    //     await Dami.connectAndLogin(auth)
    //     await Dami.listen()
    //   },
    // );
  });
  Rhum.testSuite("listen()", () => {
    // TODO(edward) Test case is leaking ops
    // Rhum.testCase("Listens for events", async () => {
    //   const Dami = new DAMI(ami);
    //   Dami.on("FullyBooted", (e) => {
    //     console.log(e)
    //   })
    //   await Dami.connectAndLogin(auth)
    //   await Dami.listen();
    // });
  });
});

Rhum.run();
