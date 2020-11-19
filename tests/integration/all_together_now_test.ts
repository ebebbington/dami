// deno-lint-ignore-file

import { DAMI } from "../../src/dami.ts";
import { ami, auth } from "../utils.ts";
import { Rhum } from "../deps.ts";

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

Deno.test({
  name: "Can listen for events",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn(): Promise<void> {
    const Dami = new DAMI(ami);
    await Dami.connect(auth);
    let fullyBootedEvent: any = [];
    let peerEntryEvent: any = [];
    let SipChannelsEvent: any = [];
    let SipShowPeersEvent: any = [];
    let getConfigEvent: any = [];
    Dami.on("FullyBooted", (data) => {
      fullyBootedEvent = data;
    });
    Dami.on("PeerEntry", (data) => {
      peerEntryEvent = data;
    });
    await Dami.to("Command", {
      Command: "sip show channels",
    }, (data) => {
      SipChannelsEvent = data;
    });
    await Dami.to("Command", {
      Command: "sip show peers",
    }, (data) => {
      SipShowPeersEvent = data;
    });
    await Dami.to("SIPPeers", {});
    await Dami.to("GetConfig", {
      Filename: "sip.conf",
    }, (data) => {
      getConfigEvent = data;
    });
    setTimeout(() => {
      Rhum.asserts.assertEquals(expectedSipConfResponse, getConfigEvent);
      Dami.close();
    }, 3000);
  },
});
