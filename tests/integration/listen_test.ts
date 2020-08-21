import { DAMI, DAMIData } from "../../src/dami.ts";
import { Rhum } from "../deps.ts";
import { auth, ami } from "../utils.ts"

Deno.test({
  name: "Can listen for events",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn(): Promise<void> {
    const Dami = new DAMI(ami);
    await Dami.connectAndLogin(auth);
    await Dami.listen();
    let res: DAMIData = {}
    Dami.on("FullyBooted", (data) => {
      res = data
    })
    await setTimeout(() => {
      Rhum.asserts.assertEquals(res["Event"], "FullyBooted")
      Rhum.asserts.assertEquals(res["Privilege"], "system,all")
      Rhum.asserts.assertEquals(res["Status"], "Fully Booted")
      Rhum.asserts.assertEquals(res["Response"], "Success")
      Rhum.asserts.assertEquals(res["Message"], "Authentication accepted")
      Dami.close()
    }, 1000)
  },
});