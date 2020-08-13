import { Rhum } from "../deps.ts";

Rhum.testPlan("tests/unit/dami.ts", () => {
  Rhum.testSuite("constructor()", () => {
    Rhum.testCase(
      "Sets the configs correctly when all props are passed in",
      () => {
      },
    );
    Rhum.testCase(
      "Sets the configs correctly when some props are passed in",
      () => {
      },
    );
    Rhum.testCase(
      "Defaults to `defaultConfigs` when no configs were passed in",
      () => {
      },
    );
  });
  Rhum.testSuite("close()", () => {
    Rhum.testCase("Closes the connection", () => {
    });
  });
  Rhum.testCase("connectAndLogin()", () => {
    Rhum.testCase("Throws an error when `conn` is already set", () => {
    });
    Rhum.testCase("Successfully connects and logs in to the AMI", () => {
    });
  });
  Rhum.testSuite("to()", () => {
    Rhum.testCase("Sends an event", () => {

    });
  });
  Rhum.testSuite("on()", () => {
    Rhum.testCase(
      "Listens for and receives an event for the event type",
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
