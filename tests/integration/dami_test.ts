import { Rhum } from "../deps.ts";
import { DAMI } from "../../mod.ts";
import { ami, auth } from "../utils.ts";
import { deferred } from "../../deps.ts";

const expectedSipConfResponse = [{
  ActionID: 4,
  Response: "Success",
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
}];

Rhum.testPlan("tests/integration/dami_test.ts", () => {
  Rhum.testSuite("Events with Output", () => {
    Rhum.testCase(
      "An event with output returns the data correctly",
      async () => {
        const Dami = new DAMI(ami);
        await Dami.connect(auth);
        const res = await Dami.to("Command", {
          Command: "sip show peers",
        });
        Rhum.asserts.assertEquals(
          //@ts-ignore tsc is throwin errors about the types, but if it fails then the code is wrong anyways
          res[0]["Output"][0],
          "Name/username             Host                                    Dyn Forcerport Comedia    ACL Port     Status      Description                      ",
        );
        Rhum.asserts.assertEquals(
          //@ts-ignore tsc is throwin errors about the types, but if it fails then the code is wrong anyways
          res[0]["Output"][1],
          "6001                      (Unspecified)                            D  Auto (No)  No             0        Unmonitored                                  ",
        );
        Rhum.asserts.assertEquals(
          //@ts-ignore tsc is throwin errors about the types, but if it fails then the code is wrong anyways
          res[0]["Output"][2],
          "6002                      (Unspecified)                            D  Auto (No)  No             0        Unmonitored                                  ",
        );
        Rhum.asserts.assertEquals(
          //@ts-ignore tsc is throwin errors about the types, but if it fails then the code is wrong anyways
          res[0]["Output"][3],
          "2 sip peers [Monitored: 0 online, 0 offline Unmonitored: 0 online, 2 offline]",
        );
        Dami.close();
      },
    );
  });
  Rhum.testSuite("Generic events", () => {
    Rhum.testCase("Should handle generic events sent by asterisk", async () => { // its quite normal for this to take 3m 45s, or less or more
      // we're just going to wait for the first event asterisk sentds back, which is a while....
      const Dami = new DAMI(ami);
      await Dami.connect(auth);
      console.info(
        "It is normal for this to take a long time, for me on my host machine it takes around 3m 45s",
      );
      const promise = deferred();
      Dami.on("PeerStatus", () => {
        promise.resolve();
      });
      await promise;
      Dami.close();
      Rhum.asserts.assertEquals(true, true); // we're really just making sure the promise gets resolved
    });
  });
  Rhum.testSuite("Generic events and triggered events", () => {
    Rhum.testCase(
      "Triggering an event should interfere with handling generic events after",
      async () => {
        const Dami = new DAMI(ami);
        await Dami.connect(auth);
        await Dami.to("SIPPeers", {});
        const promise = deferred();
        Dami.on("PeerStatus", (event) => {
          promise.resolve();
        });
        await promise;
        Dami.close();
      },
    );
    Rhum.testCase(
      "Generic events shouldn't interfere with handling triggered events after",
      async () => {
        const Dami = new DAMI(ami);
        await Dami.connect(auth);
        const promise = deferred();
        Dami.on("PeerStatus", (event) => {
          promise.resolve();
        });
        await promise;
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
      },
    );
  });
  Rhum.testSuite("Sending Actions To Return Events Works", () => {
    Rhum.testCase("SIPPeers Action -> PeerEntry Event", async () => {
      const Dami = new DAMI(ami);
      await Dami.connect(auth);
      const res = await Dami.to("SIPPeers", {});
      Dami.close();
      Rhum.asserts.assertEquals(res.length, 4);
      const [numberOfProps1, numberOfProps2] = [
        Object.keys(res[1]).length,
        Object.keys(res[2]).length,
      ];
      Rhum.asserts.assertEquals(numberOfProps1, 19);
      Rhum.asserts.assertEquals(numberOfProps2, 19);
      Rhum.asserts.assertEquals(res[1].Event, "PeerEntry");
      Rhum.asserts.assertEquals(res[1].Channeltype, "SIP");
      Rhum.asserts.assertEquals(res[1].ObjectName, 6001);
      Rhum.asserts.assertEquals(res[1].ChanObjectType, "peer");
      Rhum.asserts.assertEquals(res[1].IPaddress, "-none-");
      Rhum.asserts.assertEquals(res[1].IPport, 0);
      Rhum.asserts.assertEquals(res[1].Dynamic, "yes");
      Rhum.asserts.assertEquals(res[1].AutoForcerport, "yes");
      Rhum.asserts.assertEquals(res[1].Forcerport, "no");
      Rhum.asserts.assertEquals(res[1].AutoComedia, "no");
      Rhum.asserts.assertEquals(res[1].Comedia, "no");
      Rhum.asserts.assertEquals(res[1].VideoSupport, "no");
      Rhum.asserts.assertEquals(res[1].TextSupport, "no");
      Rhum.asserts.assertEquals(res[1].ACL, "no");
      Rhum.asserts.assertEquals(res[1].Status, "Unmonitored");
      Rhum.asserts.assertEquals(res[1].RealtimeDevice, "no");
      Rhum.asserts.assertEquals(res[2].Event, "PeerEntry");
      Rhum.asserts.assertEquals(res[2].Channeltype, "SIP");
      Rhum.asserts.assertEquals(res[2].ObjectName, 6002);
      Rhum.asserts.assertEquals(res[2].ChanObjectType, "peer");
      Rhum.asserts.assertEquals(res[2].IPaddress, "-none-");
      Rhum.asserts.assertEquals(res[2].IPport, 0);
      Rhum.asserts.assertEquals(res[2].Dynamic, "yes");
      Rhum.asserts.assertEquals(res[2].AutoForcerport, "yes");
      Rhum.asserts.assertEquals(res[2].Forcerport, "no");
      Rhum.asserts.assertEquals(res[2].AutoComedia, "no");
      Rhum.asserts.assertEquals(res[2].Comedia, "no");
      Rhum.asserts.assertEquals(res[2].VideoSupport, "no");
      Rhum.asserts.assertEquals(res[2].TextSupport, "no");
      Rhum.asserts.assertEquals(res[2].ACL, "no");
      Rhum.asserts.assertEquals(res[2].Status, "Unmonitored");
      Rhum.asserts.assertEquals(res[2].RealtimeDevice, "no");
    });
    Rhum.testCase("Command Action", async () => {
      const Dami = new DAMI(ami);
      await Dami.connect(auth);
      const res = await Dami.to("Command", {
        Command: "sip show channels",
      });
      Dami.close();
      Rhum.asserts.assertEquals(res[0]["ActionID"], 3);
      Rhum.asserts.assertEquals(
        res[0]["Message"],
        "Command output follows",
      );
      Rhum.asserts.assertEquals(
        res[0]["Output"]![0],
        "Peer             User/ANR         Call ID          Format           Hold     Last Message    Expiry     Peer      ",
      );
      Rhum.asserts.assertEquals(
        res[0]["Output"]![1],
        "0 active SIP dialogs",
      );
      Rhum.asserts.assertEquals(res[0]["Response"], "Success");
    });
  });
});

Rhum.run();
