import { DAMI, Event } from "../../src/dami.ts";
import { Rhum } from "../deps.ts";
import { ami, auth } from "../utils.ts";

Deno.test({
  name: "Can listen for events",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn(): Promise<void> {
    const Dami = new DAMI(ami);
    await Dami.connectAndLogin(auth);
    await Dami.listen();
    let res: Event[] = [];
    Dami.on("FullyBooted", (data) => {
      res = data;
    });
    await setTimeout(() => {
      Rhum.asserts.assertEquals(res.length, 1);
      Rhum.asserts.assertEquals(res[0]["Event"], "FullyBooted");
      Rhum.asserts.assertEquals(res[0]["Privilege"], "system,all");
      Rhum.asserts.assertEquals(res[0]["Status"], "Fully Booted");
      Rhum.asserts.assertEquals(res[0]["Response"], "Success");
      Rhum.asserts.assertEquals(res[0]["Message"], "Authentication accepted");
      Dami.close();
    }, 1000);
  },
});
