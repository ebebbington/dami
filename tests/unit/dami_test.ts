import { Rhum } from "../deps.ts";
import { DAMI } from "../../src/dami.ts";

const ami = {
  hostname: "0.0.0.0",
  port: 5038,
  logger: false,
};

const auth = {
  username: "admin",
  secret: "mysecret",
};

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
      let expectedErr = {
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
    Rhum.testCase("Sends an event", async () => {
      const Dami = new DAMI(ami);
      await Dami.connectAndLogin(auth);
      await Dami.listen();
      await Dami.to("GetConfig", {});
      Dami.close();
    });
  });
  Rhum.testSuite("on()", () => {
    Rhum.testCase(
      "Registers a listener",
      () => {
        const Dami = new DAMI(ami);
        Dami.on("SomeEvent", (data) => {
        });
      },
    );
  });
  Rhum.testSuite("listen()", () => {
    Rhum.testCase("Listens for events", () => {
    });
  });
  // Rhum.testSuite("triggerEvent()", () => {
  //   Rhum.testCase("Triggers and returns the expected event when using a callback", async () => {
  //     const Dami = new DAMI(ami);
  //     await Dami.connectAndLogin(auth);
  //     //await Dami.listen()
  //     let eventData;
  //     // await Dami.triggerEvent("SIPPeers",  {}, (data) => {
  //     //   eventData = data
  //     //   //Dami.close()
  //     // })
  //     console.log('event data')
  //     console.log(eventData)
  //     Dami.close()
  //   })
  //   Rhum.testCase("Triggers and returns the expected event when assigning to a value", async () => {
  //
  //   })
  // })
});

Rhum.run();
