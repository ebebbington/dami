import { Rhum } from "../deps.ts";
import { deferred } from "../../deps.ts";
import { DAMI } from "../../mod.ts";
import { ami, auth } from "../utils.ts";

Rhum.testPlan("tests/unit/dami_test.ts", () => {
  Rhum.testSuite("connected", () => {
    Rhum.testCase("Set to true when we connect", async () => {
      const Dami = new DAMI(ami);
      await Dami.connect(auth);
      Rhum.asserts.assertEquals(Dami.connected, true);
      Dami.close();
    });
    Rhum.testCase("Set to false by default", () => {
      const Dami = new DAMI(ami);
      Rhum.asserts.assertEquals(Dami.connected, false);
    });
    Rhum.testCase("Set to false when we close", async () => {
      const Dami = new DAMI(ami);
      await Dami.connect(auth);
      Dami.close();
      Rhum.asserts.assertEquals(Dami.connected, false);
    });
    Rhum.testCase("Set to false when we fail authentication", async () => {
      const Dami = new DAMI(ami);
      try {
        await Dami.connect({ username: "ass", secret: "fff" });
      } catch (_err) {
        // do nothing, we dont care that it throws
      }
      Rhum.asserts.assertEquals(Dami.connected, false);
    });
  });
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
    Rhum.testCase(
      "Returns the auth/connect events when successfully connected",
      async () => {
        const Dami = new DAMI(ami);
        const res = await Dami.connect(auth);
        Dami.close();
        Rhum.asserts.assertEquals(res.length, 2);
        Rhum.asserts.assertEquals(res[0], {
          Response: "Success",
          Message: "Authentication accepted",
        });
        Rhum.asserts.assertEquals(Object.keys(res[1]).length, 5);
        Rhum.asserts.assertEquals(res[1]["Privilege"], "system,all");
        Rhum.asserts.assertEquals(res[1]["Status"], "Fully Booted");
      },
    );
    Rhum.testCase(
      "Also calls a FullyBooted listener if set, when connected",
      async () => {
        const Dami = new DAMI(ami);
        const promise = deferred();
        Dami.on("FullyBooted", (event) => {
          promise.resolve(event);
        });
        await Dami.connect(auth);
        // deno-lint-ignore no-explicit-any
        const event: any = await promise;
        Dami.close();
        Rhum.asserts.assert(!!event);
        Rhum.asserts.assertEquals(Object.keys(event).length, 5);
        Rhum.asserts.assertEquals(event["Event"], "FullyBooted");
      },
    );
    Rhum.testCase("Throws an error when auth creds are invalid", async () => {
      const Dami = new DAMI(ami);
      let err = false;
      let errMsg = "";
      try {
        await Dami.connect({ username: "he", secret: "e" });
      } catch (error) {
        err = true;
        errMsg = error.message;
      }
      Rhum.asserts.assertEquals(err, true);
      Rhum.asserts.assertEquals(
        errMsg,
        "Authentication failed. Unable to login. Check your username and password are correct.",
      );
    });
  });
  Rhum.testSuite("ping()", () => {
    Rhum.testCase("Can ping the server when connected", async () => {
      const Dami = new DAMI(ami);
      await Dami.connect(auth);
      const res = await Dami.ping();
      Dami.close();
      Rhum.asserts.assertEquals(res, true);
    });
  });
  Rhum.testSuite("to()", () => {
    Rhum.testCase(
      "Throws an error when the action is  wrong because an event holds an error",
      async () => {
        const Dami = new DAMI(ami);
        await Dami.connect(auth);
        let err = false;
        let errMsg = "";
        try {
          await Dami.to("GetConfig", {});
        } catch (error) {
          err = true;
          errMsg = error.message;
        }
        Dami.close();
        Rhum.asserts.assertEquals(err, true);
        Rhum.asserts.assertEquals(errMsg, "Filename not specified");
      },
    );
    Rhum.testCase("Sends an action and returns the event", async () => {
      const Dami = new DAMI(ami);
      await Dami.connect(auth);
      const result = await Dami.to("GetConfig", { Filename: "sip.conf" });
      Dami.close();
      Rhum.asserts.assertEquals(result, [
        {
          Response: "Success",
          ActionID: 3,
          "Category-000000": "general",
          "Line-000000-000000": "transport=udp",
          "Category-000001": 6001,
          "Templates-000001": "friends_internal",
          "Line-000001-000000": "type=friend",
          "Line-000001-000001": "host=dynamic",
          "Line-000001-000002": "context=from-internal",
          "Line-000001-000003": "disallow=all",
          "Line-000001-000004": "allow=ulaw",
          "Line-000001-000005": "secret=verysecretpassword",
          "Category-000002": 6002,
          "Templates-000002": "friends_internal",
          "Line-000002-000000": "type=friend",
          "Line-000002-000001": "host=dynamic",
          "Line-000002-000002": "context=from-internal",
          "Line-000002-000003": "disallow=all",
          "Line-000002-000004": "allow=ulaw",
          "Line-000002-000005": "secret=othersecretpassword",
        },
      ]);
    });
  });
  Rhum.testSuite("on()", () => {
    Rhum.testCase(
      "Registers a listener",
      async () => {
        const Dami = new DAMI(ami);
        const promise = deferred();
        Dami.on("FullyBooted", () => {
          promise.resolve();
        });
        await Dami.connect(auth);
        await promise;
        Dami.close();
      },
    );
  });
  Rhum.testSuite("removeListener()", () => {
    Rhum.testCase(
      "An error is thrown when trying to remove a listen that doesn't exist",
      () => {
        const Dami = new DAMI(ami);
        Rhum.asserts.assertThrows(() => {
          Dami.removeListener("I dont exist");
        });
      },
    );
    Rhum.testCase("Can remove a listener that exists", async () => {
      const Dami = new DAMI(ami);
      const promise = deferred();
      let cbCalled = false;
      Dami.on("FullyBooted", () => {
        if (cbCalled) {
          throw new Error(
            "I should not be called a second time, the listener should have removed me",
          );
        }
        cbCalled = true;
        promise.resolve();
      });
      await Dami.connect(auth);
      await promise;
      Dami.close();
      Dami.removeListener("FullyBooted");
      await Dami.connect(auth);
      Dami.close();
    });
  });
});

Rhum.run();
