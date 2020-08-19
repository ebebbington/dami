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
  name: "Can connect, login and receieve/send events",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn(): Promise<void> {
    // Can connect and login
    const Dami = new DAMI(ami);
    await Dami.connectAndLogin(auth);
    // Can receive events
    // deno-lint-ignore no-explicit-any
    let res: any = {};
    // deno-lint-ignore no-explicit-any
    const peerEntryResults: any = [];
    Dami.on("FullyBooted", (data) => {
      res = data;
    });
    Dami.on("PeerEntry", (data) => {
      peerEntryResults.push(data);
    });
    await Dami.listen();
    await setTimeout(() => {
      Rhum.asserts.assertEquals(res.Event, "FullyBooted");
      Rhum.asserts.assertEquals(res.Message, "Authentication accepted");
    }, 2000);

    // can send/trigger events
    await Dami.to("SIPPeers", {});
    await setTimeout(() => {
      Rhum.asserts.assertEquals(peerEntryResults.length, 2);
      Rhum.asserts.assertEquals(peerEntryResults[0].ObjectName, 6001);
      Rhum.asserts.assertEquals(peerEntryResults[1].ObjectName, 6002);
      Dami.close();
    }, 2000);
  },
});
