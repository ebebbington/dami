import { DAMI } from "../../src/dami.ts";
import { auth, ami } from "../utils.ts";
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
    await Dami.connectAndLogin(auth);
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
    await Dami.listen();
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
      Rhum.asserts.assertEquals(fullyBootedEvent[0]["Event"], "FullyBooted");
      Rhum.asserts.assertEquals(fullyBootedEvent[0]["Privilege"], "system,all");
      Rhum.asserts.assertEquals(fullyBootedEvent[0]["Status"], "Fully Booted");
      Rhum.asserts.assertEquals(
        fullyBootedEvent[0]["Message"],
        "Authentication accepted",
      );
      Rhum.asserts.assertEquals(peerEntryEvent[1].Event, "PeerEntry");
      Rhum.asserts.assertEquals(peerEntryEvent[1].Channeltype, "SIP");
      Rhum.asserts.assertEquals(peerEntryEvent[1].ObjectName, 6001);
      Rhum.asserts.assertEquals(peerEntryEvent[1].ChanObjectType, "peer");
      Rhum.asserts.assertEquals(peerEntryEvent[1].IPaddress, "-none-");
      Rhum.asserts.assertEquals(peerEntryEvent[1].IPport, 0);
      Rhum.asserts.assertEquals(peerEntryEvent[1].Dynamic, "yes");
      Rhum.asserts.assertEquals(peerEntryEvent[1].AutoForcerport, "yes");
      Rhum.asserts.assertEquals(peerEntryEvent[1].Forcerport, "no");
      Rhum.asserts.assertEquals(peerEntryEvent[1].AutoComedia, "no");
      Rhum.asserts.assertEquals(peerEntryEvent[1].Comedia, "no");
      Rhum.asserts.assertEquals(peerEntryEvent[1].VideoSupport, "no");
      Rhum.asserts.assertEquals(peerEntryEvent[1].TextSupport, "no");
      Rhum.asserts.assertEquals(peerEntryEvent[1].ACL, "no");
      Rhum.asserts.assertEquals(peerEntryEvent[1].Status, "Unmonitored");
      Rhum.asserts.assertEquals(peerEntryEvent[1].RealtimeDevice, "no");
      Rhum.asserts.assertEquals(peerEntryEvent[2].Event, "PeerEntry");
      Rhum.asserts.assertEquals(peerEntryEvent[2].Channeltype, "SIP");
      Rhum.asserts.assertEquals(peerEntryEvent[2].ObjectName, 6002);
      Rhum.asserts.assertEquals(peerEntryEvent[2].ChanObjectType, "peer");
      Rhum.asserts.assertEquals(peerEntryEvent[2].IPaddress, "-none-");
      Rhum.asserts.assertEquals(peerEntryEvent[2].IPport, 0);
      Rhum.asserts.assertEquals(peerEntryEvent[2].Dynamic, "yes");
      Rhum.asserts.assertEquals(peerEntryEvent[2].AutoForcerport, "yes");
      Rhum.asserts.assertEquals(peerEntryEvent[2].Forcerport, "yes");
      Rhum.asserts.assertEquals(peerEntryEvent[2].AutoComedia, "no");
      Rhum.asserts.assertEquals(peerEntryEvent[2].Comedia, "no");
      Rhum.asserts.assertEquals(peerEntryEvent[2].VideoSupport, "no");
      Rhum.asserts.assertEquals(peerEntryEvent[2].TextSupport, "no");
      Rhum.asserts.assertEquals(peerEntryEvent[2].ACL, "no");
      Rhum.asserts.assertEquals(peerEntryEvent[2].Status, "Unmonitored");
      Rhum.asserts.assertEquals(peerEntryEvent[2].RealtimeDevice, "no");
      Rhum.asserts.assertEquals(SipChannelsEvent[0]["ActionID"], 1);
      Rhum.asserts.assertEquals(
        SipChannelsEvent[0]["Message"],
        "Command output follows",
      );
      Rhum.asserts.assertEquals(
        SipChannelsEvent[0]["Output"][0],
        "Peer             User/ANR         Call ID          Format           Hold     Last Message    Expiry     Peer      ",
      );
      Rhum.asserts.assertEquals(
        SipChannelsEvent[0]["Output"][1],
        "0 active SIP dialogs",
      );
      Rhum.asserts.assertEquals(SipChannelsEvent[0]["Response"], "Success");
      Rhum.asserts.assertEquals(SipShowPeersEvent[0]["ActionID"], 2);
      Rhum.asserts.assertEquals(
        SipShowPeersEvent[0]["Message"],
        "Command output follows",
      );
      Rhum.asserts.assertEquals(
        SipShowPeersEvent[0]["Output"][0],
        "Name/username             Host                                    Dyn Forcerport Comedia    ACL Port     Status      Description                      ",
      );
      Rhum.asserts.assertEquals(
        SipShowPeersEvent[0]["Output"][1],
        "6001                      (Unspecified)                            D  Auto (No)  No             0        Unmonitored                                  ",
      );
      Rhum.asserts.assertEquals(
        SipShowPeersEvent[0]["Output"][2],
        "6002/6002                 (Unspecified)                            D  Auto (Yes) No             0        Unmonitored                                  ",
      );
      Rhum.asserts.assertEquals(
        SipShowPeersEvent[0]["Output"][3],
        "2 sip peers [Monitored: 0 online, 0 offline Unmonitored: 0 online, 2 offline]",
      );
      Rhum.asserts.assertEquals(SipShowPeersEvent[0]["Response"], "Success");
      Rhum.asserts.assertEquals(expectedSipConfResponse, getConfigEvent);
      Dami.close();
    }, 2000);
  },
});
