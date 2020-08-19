import { DAMI, DAMIData } from "../../src/dami.ts";
import { Rhum } from "../deps.ts";

const ami = {
  hostname: "0.0.0.0",
  port: 5038,
  logger: false,
};

const auth = {
  username: "admin",
  secret: "mysecret",
};

function sleep(milliseconds: number) {
  var start = new Date().getTime();
  for (var i = 0; i < 1e7; i++) {
    if ((new Date().getTime() - start) > milliseconds) {
      break;
    }
  }
}

Deno.test({
  name: "Returns the expected data on a event response",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn(): Promise<void> {
    const Dami = new DAMI(ami);
    await Dami.connectAndLogin(auth);
    await Dami.listen()
    let fullyBootedRes: DAMIData = {}
    Dami.on("FullyBooted", (data) => {
      fullyBootedRes = data
    })
    let peerEntryRes: Array<DAMIData> = []
    Dami.on("PeerEntry", (data) => {
      peerEntryRes.push(data)
    })
    Dami.to("SIPPeers", {})
    await setTimeout(() => {
      // Check response data has ONLY the set amount of properties, and assert that data in those properties
      const numberOfProps = Object.keys(fullyBootedRes).length
      Rhum.asserts.assertEquals(numberOfProps, 7) // "FullyBooted" returns 7 props
      Rhum.asserts.assertEquals(fullyBootedRes.Event, "FullyBooted")
      Rhum.asserts.assertEquals(fullyBootedRes.Privilege, "system,all")
      Rhum.asserts.assertEquals(fullyBootedRes.Status, "Fully Booted")
      Rhum.asserts.assertEquals(fullyBootedRes.Response, "Success")
      Rhum.asserts.assertEquals(fullyBootedRes.Message, "Authentication accepted")
      // And ensure things that trigger multiple events are correct
      Rhum.asserts.assertEquals(peerEntryRes.length, 2)
      const [numberOfProps2, numberOfProps3] = [Object.keys(peerEntryRes[0]).length, Object.keys(peerEntryRes[1]).length]
      Rhum.asserts.assertEquals(numberOfProps2, 18)
      Rhum.asserts.assertEquals(numberOfProps3, 18)
      Rhum.asserts.assertEquals(numberOfProps, 7) // "FullyBooted" returns 7 props
      Rhum.asserts.assertEquals(peerEntryRes[0].Event, "PeerEntry")
      Rhum.asserts.assertEquals(peerEntryRes[0].Channeltype, "SIP")
      Rhum.asserts.assertEquals(peerEntryRes[0].ObjectName, 6001)
      Rhum.asserts.assertEquals(peerEntryRes[0].ChanObjectType, "peer")
      Rhum.asserts.assertEquals(peerEntryRes[0].IPaddress, "-none-")
      Rhum.asserts.assertEquals(peerEntryRes[0].IPport, 0)
      Rhum.asserts.assertEquals(peerEntryRes[0].Dynamic, "yes")
      Rhum.asserts.assertEquals(peerEntryRes[0].AutoForcerport, "yes")
      Rhum.asserts.assertEquals(peerEntryRes[0].Forcerport, "no")
      Rhum.asserts.assertEquals(peerEntryRes[0].AutoComedia, "no")
      Rhum.asserts.assertEquals(peerEntryRes[0].Comedia, "no")
      Rhum.asserts.assertEquals(peerEntryRes[0].VideoSupport, "no")
      Rhum.asserts.assertEquals(peerEntryRes[0].TextSupport, "no")
      Rhum.asserts.assertEquals(peerEntryRes[0].ACL, "no")
      Rhum.asserts.assertEquals(peerEntryRes[0].Status, "Unmonitored")
      Rhum.asserts.assertEquals(peerEntryRes[0].RealtimeDevice, "no")
      Rhum.asserts.assertEquals(peerEntryRes[0].Description, 0)
      Rhum.asserts.assertEquals(peerEntryRes[0].Accountcode, 0)
      Rhum.asserts.assertEquals(peerEntryRes[1].Event, "PeerEntry")
      Rhum.asserts.assertEquals(peerEntryRes[1].Channeltype, "SIP")
      Rhum.asserts.assertEquals(peerEntryRes[1].ObjectName, 6002)
      Rhum.asserts.assertEquals(peerEntryRes[1].ChanObjectType, "peer")
      Rhum.asserts.assertEquals(peerEntryRes[1].IPaddress, "-none-")
      Rhum.asserts.assertEquals(peerEntryRes[1].IPport, 0)
      Rhum.asserts.assertEquals(peerEntryRes[1].Dynamic, "yes")
      Rhum.asserts.assertEquals(peerEntryRes[1].AutoForcerport, "yes")
      Rhum.asserts.assertEquals(peerEntryRes[1].Forcerport, "no")
      Rhum.asserts.assertEquals(peerEntryRes[1].AutoComedia, "no")
      Rhum.asserts.assertEquals(peerEntryRes[1].Comedia, "no")
      Rhum.asserts.assertEquals(peerEntryRes[1].VideoSupport, "no")
      Rhum.asserts.assertEquals(peerEntryRes[1].TextSupport, "no")
      Rhum.asserts.assertEquals(peerEntryRes[1].ACL, "no")
      Rhum.asserts.assertEquals(peerEntryRes[1].Status, "Unmonitored")
      Rhum.asserts.assertEquals(peerEntryRes[1].RealtimeDevice, "no")
      Rhum.asserts.assertEquals(peerEntryRes[1].Description, 0)
      Rhum.asserts.assertEquals(peerEntryRes[1].Accountcode, 0)
      Dami.close()
    }, 2000);
  }
})