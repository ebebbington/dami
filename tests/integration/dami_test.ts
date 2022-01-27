import { assertEquals } from "../deps.ts";
import { DAMI } from "../../mod.ts";
import { ami, auth } from "../utils.ts";
import { deferred } from "../../deps.ts";

// const expectedSipConfResponse = [{
//   ActionID: 4,
//   Response: "Success",
//   "Category-000000": "general",
//   "Line-000000-000000": "transport=udp",
//   "Category-000001": 6001,
//   "Templates-000001": "friends_internal",
//   "Line-000001-000000": "type=friend",
//   "Line-000001-000001": "host=dynamic",
//   "Line-000001-000002": "context=from-internal",
//   "Line-000001-000003": "disallow=all",
//   "Line-000001-000004": "allow=ulaw",
//   "Line-000001-000005": "secret=verysecretpassword",
//   "Category-000002": 6002,
//   "Templates-000002": "friends_internal",
//   "Line-000002-000000": "type=friend",
//   "Line-000002-000001": "host=dynamic",
//   "Line-000002-000002": "context=from-internal",
//   "Line-000002-000003": "disallow=all",
//   "Line-000002-000004": "allow=ulaw",
//   "Line-000002-000005": "secret=othersecretpassword",
// }];

Deno.test("Command", async (t) => {
  await t.step(
    "An event with output (Command) returns the data correctly",
    async () => {
      const Dami = new DAMI(ami);
      await Dami.connect(auth);
      const res = await Dami.to("Command", {
        Command: "sip show peers",
      });
      assertEquals(
        //@ts-ignore tsc is throwin errors about the types, but if it fails then the code is wrong anyways
        res[0]["Output"][0],
        "Name/username             Host                                    Dyn Forcerport Comedia    ACL Port     Status      Description                      ",
      );
      assertEquals(
        //@ts-ignore tsc is throwin errors about the types, but if it fails then the code is wrong anyways
        res[0]["Output"][1],
        "6001                      (Unspecified)                            D  Auto (No)  No             0        Unmonitored                                  ",
      );
      assertEquals(
        //@ts-ignore tsc is throwin errors about the types, but if it fails then the code is wrong anyways
        res[0]["Output"][2],
        "6002                      (Unspecified)                            D  Auto (No)  No             0        Unmonitored                                  ",
      );
      assertEquals(
        //@ts-ignore tsc is throwin errors about the types, but if it fails then the code is wrong anyways
        res[0]["Output"][3],
        "2 sip peers [Monitored: 0 online, 0 offline Unmonitored: 0 online, 2 offline]",
      );
      Dami.close();
    },
  );
});
Deno.test("Sending Actions To Return Events Works", async (t) => {
  await t.step("SIPPeers Action -> PeerEntry Event", async () => {
    const Dami = new DAMI(ami);
    await Dami.connect(auth);
    const res = await Dami.to("SIPPeers", {});
    Dami.close();
    assertEquals(res.length, 4);
    const [numberOfProps1, numberOfProps2] = [
      Object.keys(res[1]).length,
      Object.keys(res[2]).length,
    ];
    assertEquals(numberOfProps1, 19);
    assertEquals(numberOfProps2, 19);
    assertEquals(res[1].Event, "PeerEntry");
    assertEquals(res[1].Channeltype, "SIP");
    assertEquals(res[1].ObjectName, 6001);
    assertEquals(res[1].ChanObjectType, "peer");
    assertEquals(res[1].IPaddress, "-none-");
    assertEquals(res[1].IPport, 0);
    assertEquals(res[1].Dynamic, "yes");
    assertEquals(res[1].AutoForcerport, "yes");
    assertEquals(res[1].Forcerport, "no");
    assertEquals(res[1].AutoComedia, "no");
    assertEquals(res[1].Comedia, "no");
    assertEquals(res[1].VideoSupport, "no");
    assertEquals(res[1].TextSupport, "no");
    assertEquals(res[1].ACL, "no");
    assertEquals(res[1].Status, "Unmonitored");
    assertEquals(res[1].RealtimeDevice, "no");
    assertEquals(res[2].Event, "PeerEntry");
    assertEquals(res[2].Channeltype, "SIP");
    assertEquals(res[2].ObjectName, 6002);
    assertEquals(res[2].ChanObjectType, "peer");
    assertEquals(res[2].IPaddress, "-none-");
    assertEquals(res[2].IPport, 0);
    assertEquals(res[2].Dynamic, "yes");
    assertEquals(res[2].AutoForcerport, "yes");
    assertEquals(res[2].Forcerport, "no");
    assertEquals(res[2].AutoComedia, "no");
    assertEquals(res[2].Comedia, "no");
    assertEquals(res[2].VideoSupport, "no");
    assertEquals(res[2].TextSupport, "no");
    assertEquals(res[2].ACL, "no");
    assertEquals(res[2].Status, "Unmonitored");
    assertEquals(res[2].RealtimeDevice, "no");
  });
  await t.step("Command Action", async () => {
    const Dami = new DAMI(ami);
    await Dami.connect(auth);
    const res = await Dami.to("Command", {
      Command: "sip show channels",
    });
    Dami.close();
    assertEquals(res[0]["ActionID"], 3);
    assertEquals(
      res[0]["Message"],
      "Command output follows",
    );
    assertEquals(
      res[0]["Output"]![0],
      "Peer             User/ANR         Call ID          Format           Hold     Last Message    Expiry     Peer      ",
    );
    assertEquals(
      res[0]["Output"]![1],
      "0 active SIP dialogs",
    );
    assertEquals(res[0]["Response"], "Success");
  });
});
Deno.test("Reconnecting", async (t) => {
  await t.step("Can re connect after closing", async () => {
    const Dami = new DAMI(ami);
    const promise1 = deferred();
    let promise1Done = false;
    const promise2 = deferred();
    Dami.on("FullyBooted", () => {
      if (promise1Done === false) {
        promise1.resolve();
        promise1Done = true;
      } else {
        promise2.resolve();
      }
    });
    await Dami.connect(auth);
    await promise1;
    Dami.close();
    await Dami.connect(auth);
    await promise2;
    const res = await Dami.ping();
    Dami.close();
    assertEquals(res, true);
  });
});
