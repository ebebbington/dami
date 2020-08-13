import {DAMI} from "../../src/dami.ts";
import {Rhum} from "../deps.ts";

const ami = {
  hostname: "0.0.0.0",
  port: 5038,
  logger: false,
};

const auth = {
  username: "admin",
  secret: "mysecret",
};

Deno.test({
  name: "Can connect, login, and receieve events",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn(): Promise<void> {
    // Assert connection and login
    const Dami = new DAMI(ami)
    await Dami.connectAndLogin(auth)
    await Dami.listen();
    let res: any  = {}
    Dami.on("FullyBooted", (data) => {
      res = data
      Dami.close()
    })
    await setTimeout(() => {
      Rhum.asserts.assertEquals(res.Event, "FullyBooted")
      Rhum.asserts.assertEquals(res.Message, "Authentication accepted")
      Dami.close()
    }, 2000);
  }
})

Deno.test({
  name: "Can send events",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn(): Promise<void> {
    // Assert sending  events
    const Dami = new DAMI(ami)
    await Dami.connectAndLogin(auth)
    await Dami.listen();
    let res: any  = {}
    Dami.on("PeerlistComplete", (data) => {
      res = data
      Dami.close()
    })
    await Dami.to("SIPPeers", {})
    await setTimeout(() => {
      Rhum.asserts.assertEquals(res.Event, "PeerlistComplete")
      Rhum.asserts.assertEquals(res.Message, "Peer status list will follow")
      Dami.close()
    }, 2000);
  }
})