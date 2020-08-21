import { DAMI, DAMIData } from "../../src/dami.ts";
import { Rhum } from "../deps.ts";
import { ami, auth } from "../utils.ts";

Deno.test({
  name: "Returns the expected data on a event response",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn(): Promise<void> {
    const Dami = new DAMI(ami);
    await Dami.connectAndLogin(auth);
    await Dami.listen();
    let fullyBootedRes: DAMIData = {};
    Dami.on("FullyBooted", (data) => {
      fullyBootedRes = data;
    });
    let peerEntryRes: Array<DAMIData> = [];
    peerEntryRes = await Dami.to("SIPPeers", { ActionID: 12 });
    await setTimeout(() => {
      // Check response data has ONLY the set amount of properties, and assert that data in those properties
      const numberOfProps = Object.keys(fullyBootedRes).length;
      Rhum.asserts.assertEquals(numberOfProps, 7); // "FullyBooted" returns 7 props
      Rhum.asserts.assertEquals(fullyBootedRes.Event, "FullyBooted");
      Rhum.asserts.assertEquals(fullyBootedRes.Privilege, "system,all");
      Rhum.asserts.assertEquals(fullyBootedRes.Status, "Fully Booted");
      Rhum.asserts.assertEquals(fullyBootedRes.Response, "Success");
      Rhum.asserts.assertEquals(
        fullyBootedRes.Message,
        "Authentication accepted",
      );
      // And ensure things that trigger multiple events are correct
      Rhum.asserts.assertEquals(peerEntryRes.length, 4);
      const [numberOfProps2, numberOfProps3] = [
        Object.keys(peerEntryRes[1]).length,
        Object.keys(peerEntryRes[2]).length,
      ];
      Rhum.asserts.assertEquals(numberOfProps2, 17);
      Rhum.asserts.assertEquals(numberOfProps3, 17);
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
      Rhum.asserts.assertEquals(peerEntryRes[2].Forcerport, "no");
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
