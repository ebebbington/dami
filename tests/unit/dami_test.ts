import { deferred } from "../../deps.ts";
import { DAMI } from "../../mod.ts";
import { ami, auth } from "../utils.ts";
import { assertEquals, assertRejects, assertThrows } from "../deps.ts";

Deno.test("connected", async (t) => {
  await t.step("Set to true when we connect", async () => {
    const Dami = new DAMI(ami);
    await Dami.connect(auth);
    assertEquals(Dami.connected, true);
    Dami.close();
  });
  await t.step("Set to false by default", () => {
    const Dami = new DAMI(ami);
    assertEquals(Dami.connected, false);
  });
  await t.step("Set to false when we close", async () => {
    const Dami = new DAMI(ami);
    await Dami.connect(auth);
    Dami.close();
    assertEquals(Dami.connected, false);
  });
  await t.step("Set to false when we fail authentication", async () => {
    const Dami = new DAMI(ami);
    try {
      await Dami.connect({ username: "ass", secret: "fff" });
    } catch (_err) {
      // do nothing, we dont care that it throws
    }
    assertEquals(Dami.connected, false);
  });
});

Deno.test("close()", async (t) => {
  await t.step("Closes the connection", async () => {
    const Dami = new DAMI(ami);
    await Dami.connect(auth);
    Dami.close();
    assertRejects(async () => {
      await Dami.ping();
    });
  });

  await t.step("Should not throw if already closed", async () => {
    const Dami = new DAMI(ami);
    await Dami.connect(auth);
    Dami.close();
    Dami.close();
  });
});

Deno.test("connect()", async (t) => {
  await t.step("Throws an error when `conn` is already set", async () => {
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
    assertEquals(expectedErr, {
      msg: "A connection has already been made",
      thrown: true,
    });
    Dami.close();
  });
  await t.step("Successfully connects and logs in to the AMI", async () => {
    const Dami = new DAMI(ami);
    await Dami.connect(auth);
    Dami.close();
  });
  await t.step(
    "Returns the auth/connect events when successfully connected",
    async () => {
      const Dami = new DAMI(ami);
      const res = await Dami.connect(auth);
      Dami.close();
      assertEquals(res.length, 2);
      assertEquals(res[0], {
        Response: "Success",
        Message: "Authentication accepted",
      });
      assertEquals(Object.keys(res[1]).length, 5);
      assertEquals(res[1]["Privilege"], "system,all");
      assertEquals(res[1]["Status"], "Fully Booted");
    },
  );
  await t.step(
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
      assertEquals(!!event, true);
      assertEquals(Object.keys(event).length, 5);
      assertEquals(event["Event"], "FullyBooted");
    },
  );
  await t.step("Throws an error when auth creds are invalid", async () => {
    const Dami = new DAMI(ami);
    let err = false;
    let errMsg = "";
    try {
      await Dami.connect({ username: "he", secret: "e" });
    } catch (error) {
      err = true;
      errMsg = error.message;
    }
    assertEquals(err, true);
    assertEquals(
      errMsg,
      "Authentication failed. Unable to login. Check your username and password are correct.",
    );
  });
});
Deno.test("ping()", async (t) => {
  await t.step("Can ping the server when connected", async () => {
    const Dami = new DAMI(ami);
    await Dami.connect(auth);
    const res = await Dami.ping();
    Dami.close();
    assertEquals(res, true);
  });
});
Deno.test("to()", async (t) => {
  await t.step(
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
      assertEquals(err, true);
      assertEquals(errMsg, "Filename not specified");
    },
  );
  await t.step("Sends an action and returns the event", async () => {
    const Dami = new DAMI(ami);
    await Dami.connect(auth);
    const result = await Dami.to("GetConfig", { Filename: "sip.conf" });
    Dami.close();
    assertEquals(result, [
      {
        Response: "Success",
        ActionID: 1,
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
Deno.test("on()", async (t) => {
  await t.step(
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
Deno.test("removeListener()", async (t) => {
  await t.step(
    "An error is thrown when trying to remove a listen that doesn't exist",
    () => {
      const Dami = new DAMI(ami);
      assertThrows(() => {
        Dami.removeListener("I dont exist");
      });
    },
  );
  await t.step("Can remove a listener that exists", async () => {
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
