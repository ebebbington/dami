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
  name: "Events that send output return it correctly",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn(): Promise<void> {
    // Can connect and login
    const Dami = new DAMI(ami);
    await Dami.connectAndLogin(auth);
    await Dami.listen()
    const res = await Dami.to("Command", {
        Command: "sip show peers",
        ActionID: 1
    })
    //@ts-ignore tsc is throwin errors about the types, but if it fails then the code is wrong anyways
    Rhum.asserts.assertEquals(res[0]["Output"][0], "Name/username             Host                                    Dyn Forcerport Comedia    ACL Port     Status      Description                      ")
    //@ts-ignore tsc is throwin errors about the types, but if it fails then the code is wrong anyways
    Rhum.asserts.assertEquals(res[0]["Output"][1], "6001                      (Unspecified)                            D  Auto (No)  No             0        Unmonitored                                  "
    )
    //@ts-ignore tsc is throwin errors about the types, but if it fails then the code is wrong anyways
    Rhum.asserts.assertEquals(res[0]["Output"][2], "6002                      (Unspecified)                            D  Auto (No)  No             0        Unmonitored                                  ")
    //@ts-ignore tsc is throwin errors about the types, but if it fails then the code is wrong anyways
    Rhum.asserts.assertEquals(res[0]["Output"][3], "2 sip peers [Monitored: 0 online, 0 offline Unmonitored: 0 online, 2 offline]")
    Dami.close()
  }
})