import { DAMI, DAMIData } from "../../src/dami.ts";
import { Rhum } from "../deps.ts";
import { auth, ami } from "../utils.ts"

const expectedSipConfResponse = [{
  ActionID: 1234,
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
  name: "Can send actions and use the callback with the correct response",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn(): Promise<void> {
    const Dami = new DAMI(ami);
    await Dami.connectAndLogin(auth);
    await Dami.listen();
    let cbResponse: DAMIData[] = [];
    let returnResponse: DAMIData[] = []
    await Dami.to("GetConfig", { Filename: "sip.conf", ActionID: 1234 }, (data) => {
      cbResponse = data;
      Rhum.asserts.assertEquals(data, expectedSipConfResponse);
    });
    //returnResponse = await Dami.to("GetConfig", { Filename: "sip.conf", ActionID: 1234 })
    await setTimeout(() => {
      //Rhum.asserts.assertEquals(returnResponse, expectedSipConfResponse);
      Rhum.asserts.assertEquals(cbResponse, expectedSipConfResponse)
      Dami.close();
    }, 2000);
  },
});

Deno.test({
  name: "Can send actions and use the correct returned response",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn(): Promise<void> {
    const Dami = new DAMI(ami);
    await Dami.connectAndLogin(auth);
    await Dami.listen();
    let cbResponse: DAMIData[] = [];
    const returnResponse: DAMIData[] = await Dami.to("GetConfig", { Filename: "sip.conf", ActionID: 1234 })
    await setTimeout(() => {
      Rhum.asserts.assertEquals(returnResponse, expectedSipConfResponse);
      Dami.close();
    }, 2000);
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
    const res = await Dami.to("GetConfig", { Filename: "rtp.conf", ActionID: 12 });
    // It should contain EVERYTHING, even if asterisk sent multiple events
    Rhum.asserts.assertEquals(
        res,
        [{ Response: "Error", "Message": "Config file has invalid format", ActionID: 12 }],
    );
    Dami.close();
  },
});

Deno.test({
  name: "Doesnt interfere with `listen`",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn(): Promise<void> {
    const Dami = new DAMI(ami);
    await Dami.connectAndLogin(auth);
    await Dami.listen();
    let fullyBootedRes: DAMIData = {}
    Dami.on("FullyBooted", (data) => {
      fullyBootedRes = data
    })
    const res = await Dami.to("GetConfig", { Filename: "rtp.conf", ActionID: 198 });
    Rhum.asserts.assertEquals(
        res,
        [{ Response: "Error", "Message": "Config file has invalid format", ActionID: 198  }],
    );
    const peerEntryResults: DAMIData[] = await Dami.to("SIPPeers", {ActionID: 12354});
    await setTimeout(() => {
      Rhum.asserts.assertEquals(peerEntryResults.length, 4);
      Rhum.asserts.assertEquals(peerEntryResults[0].Message, "Peer status list will follow")
      Rhum.asserts.assertEquals(peerEntryResults[1].ObjectName, 6001);
      Rhum.asserts.assertEquals(peerEntryResults[2].ObjectName, 6002);
      Rhum.asserts.assertEquals(fullyBootedRes["Event"], "FullyBooted")
      Dami.close();
    }, 3000);
  },
});
