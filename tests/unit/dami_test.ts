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

Rhum.testPlan("tests/unit/dami.ts", () => {
  Rhum.testSuite("close()", () => {
    Rhum.testCase("Closes the connection", async () => {
      const Dami = new DAMI(ami);
      await Dami.connectAndLogin(auth);
      Dami.close();
    });
  });
  Rhum.testSuite("connectAndLogin()", () => {
    Rhum.testCase("Throws an error when `conn` is already set", () => {
    });
    Rhum.testCase("Successfully connects and logs in to the AMI", async () => {
      const Dami = new DAMI(ami);
      await Dami.connectAndLogin(auth);
      Dami.close();
    });
  });
  Rhum.testSuite("to()", () => {
    Rhum.testCase("Sends an event", () => {
    });
  });
  Rhum.testSuite("on()", () => {
    Rhum.testCase(
      "Registers a listener",
      () => {
      },
    );
  });
  Rhum.testSuite("listen()", () => {
    Rhum.testSuite("Listens for events", () => {
    });
  });
});

Rhum.run();
