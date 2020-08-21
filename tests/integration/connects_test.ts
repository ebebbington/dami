import { DAMI, DAMIData } from "../../src/dami.ts";
import { Rhum } from "../deps.ts";
import { auth, ami } from "../utils.ts"

Deno.test({
  name: "Can connect and login",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn(): Promise<void> {
    // Can connect and login
    const Dami = new DAMI(ami);
    await Dami.connectAndLogin(auth);
    await Dami.listen();
    const pong = await Dami.ping()
    Rhum.asserts.assertEquals(pong, true)
    Dami.close()
  },
});
