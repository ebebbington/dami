import { Rhum } from "../deps.ts";

Rhum.testPlan("tests/integration/connects_and_listens_test.ts", () => {
  Rhum.testSuite("Connects", () => {
    Rhum.testCase("Makes a successful connection", () => {
    });
  });
  Rhum.testCase("Login", () => {
    Rhum.testCase("Can login and become authorised", () => {
    });
  });
  Rhum.testSuite("Listens", () => {
    Rhum.testCase("Can receive events", () => {
    });
  });
});

Rhum.run();
