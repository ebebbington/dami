// TODO(edward) Use .to with and without a cb. this file replaces send_actions_test ad to_test

import { DAMI } from "../../src/dami.ts";
import { Rhum } from "../deps.ts";
import { auth, ami } from "../utils.ts";

const expectedSipConfResponse = [{
  ActionID: 1,
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

Deno.test({
  name: "Gets event data with an action and using a callback",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn(): Promise<void> {
    const Dami = new DAMI(ami);
    await Dami.connectAndLogin(auth);
    await Dami.listen();
    let cbResponse: any ;
    await Dami.to(
        "GetConfig",
        { Filename: "sip.conf", ActionID: 1234 },
        (data) => {
          cbResponse = data;
        },
    );
    //returnResponse = await Dami.to("GetConfig", { Filename: "sip.conf", ActionID: 1234 })
    await setTimeout(() => {
      //Rhum.asserts.assertEquals(returnResponse, expectedSipConfResponse);
      Rhum.asserts.assertEquals(cbResponse, expectedSipConfResponse);
      Dami.close();
    }, 3000);
  },
});

Deno.test({
  name: "Can handle user errors for example error responses",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn(): Promise<void> {
    const Dami = new DAMI(ami);
    await Dami.connectAndLogin(auth);
    await Dami.listen();
    let res: any;
    await Dami.to(
        "GetConfig",
        { Filename: "rtp.conf" },
        (data) => {
          res = data
        }
    );
    setTimeout(() => {
      // It should contain EVERYTHING, even if asterisk sent multiple events
      Rhum.asserts.assertEquals(
          res,
          [{
            Response: "Error",
            "Message": "Config file has invalid format",
            ActionID: 2,
          }],
      );
      Dami.close();
    }, 2000)
  },
});

Deno.test({
  name: "Get event data with a listener and action",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn(): Promise<void> {
    const Dami = new DAMI(ami);
    await Dami.connectAndLogin(auth);
    await Dami.listen();
    let peerEntryRes: Array<any> = [];
    Dami.on("PeerEntry", (data) => {
      peerEntryRes = data
    })
    await Dami.to("SIPPeers", { ActionID: 12 });
    await setTimeout(() => {
      // And ensure things that trigger multiple events are correct
      Rhum.asserts.assertEquals(peerEntryRes.length, 4);
      const [numberOfProps1, numberOfProps2] = [
        Object.keys(peerEntryRes[1]).length,
        Object.keys(peerEntryRes[2]).length,
      ];
      Rhum.asserts.assertEquals(numberOfProps1, 17);
      Rhum.asserts.assertEquals(numberOfProps2, 17);
      Rhum.asserts.assertEquals(peerEntryRes[1].Event, "PeerEntry");
      Rhum.asserts.assertEquals(peerEntryRes[1].Channeltype, "SIP");
      Rhum.asserts.assertEquals(peerEntryRes[1].ObjectName, 6001);
      Rhum.asserts.assertEquals(peerEntryRes[1].ChanObjectType, "peer");
      Rhum.asserts.assertEquals(peerEntryRes[1].IPaddress, "-none-");
      Rhum.asserts.assertEquals(peerEntryRes[1].IPport, 0);
      Rhum.asserts.assertEquals(peerEntryRes[1].Dynamic, "yes");
      Rhum.asserts.assertEquals(peerEntryRes[1].AutoForcerport, "yes");
      Rhum.asserts.assertEquals(peerEntryRes[1].Forcerport, "no");
      Rhum.asserts.assertEquals(peerEntryRes[1].AutoComedia, "no");
      Rhum.asserts.assertEquals(peerEntryRes[1].Comedia, "no");
      Rhum.asserts.assertEquals(peerEntryRes[1].VideoSupport, "no");
      Rhum.asserts.assertEquals(peerEntryRes[1].TextSupport, "no");
      Rhum.asserts.assertEquals(peerEntryRes[1].ACL, "no");
      Rhum.asserts.assertEquals(peerEntryRes[1].Status, "Unmonitored");
      Rhum.asserts.assertEquals(peerEntryRes[1].RealtimeDevice, "no");
      Rhum.asserts.assertEquals(peerEntryRes[2].Event, "PeerEntry");
      Rhum.asserts.assertEquals(peerEntryRes[2].Channeltype, "SIP");
      Rhum.asserts.assertEquals(peerEntryRes[2].ObjectName, 6002);
      Rhum.asserts.assertEquals(peerEntryRes[2].ChanObjectType, "peer");
      Rhum.asserts.assertEquals(peerEntryRes[2].IPaddress, "-none-");
      Rhum.asserts.assertEquals(peerEntryRes[2].IPport, 0);
      Rhum.asserts.assertEquals(peerEntryRes[2].Dynamic, "yes");
      Rhum.asserts.assertEquals(peerEntryRes[2].AutoForcerport, "yes");
      Rhum.asserts.assertEquals(peerEntryRes[2].Forcerport, "yes");
      Rhum.asserts.assertEquals(peerEntryRes[2].AutoComedia, "no");
      Rhum.asserts.assertEquals(peerEntryRes[2].Comedia, "no");
      Rhum.asserts.assertEquals(peerEntryRes[2].VideoSupport, "no");
      Rhum.asserts.assertEquals(peerEntryRes[2].TextSupport, "no");
      Rhum.asserts.assertEquals(peerEntryRes[2].ACL, "no");
      Rhum.asserts.assertEquals(peerEntryRes[2].Status, "Unmonitored");
      Rhum.asserts.assertEquals(peerEntryRes[2].RealtimeDevice, "no");
      Dami.close();
    }, 2000);
  },
});