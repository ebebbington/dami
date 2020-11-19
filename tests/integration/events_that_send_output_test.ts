// deno-lint-ignore-file

import { DAMI, Event } from "../../src/dami.ts";
import { deferred, Rhum } from "../deps.ts";
import { ami, auth } from "../utils.ts";

Deno.test({
  name: "Events that send output return it correctly",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn(): Promise<void> {
    // Can connect and login
    const Dami = new DAMI(ami);
    await Dami.connect(auth);
    let res: any = [];
    const promise = deferred();
    await Dami.to("Command", {
      Command: "sip show peers",
      ActionID: 1,
    }, (data) => {
      res = data;
      promise.resolve();
    });
    await promise;
    Rhum.asserts.assertEquals(
      //@ts-ignore tsc is throwin errors about the types, but if it fails then the code is wrong anyways
      res[0]["Output"][0],
      "Name/username             Host                                    Dyn Forcerport Comedia    ACL Port     Status      Description                      ",
    );
    Rhum.asserts.assertEquals(
      //@ts-ignore tsc is throwin errors about the types, but if it fails then the code is wrong anyways
      res[0]["Output"][1],
      "6001                      (Unspecified)                            D  Auto (No)  No             0        Unmonitored                                  ",
    );
    Rhum.asserts.assertEquals(
      //@ts-ignore tsc is throwin errors about the types, but if it fails then the code is wrong anyways
      res[0]["Output"][2],
      "6002                      (Unspecified)                            D  Auto (No)  No             0        Unmonitored                                  ",
    );
    Rhum.asserts.assertEquals(
      //@ts-ignore tsc is throwin errors about the types, but if it fails then the code is wrong anyways
      res[0]["Output"][3],
      "2 sip peers [Monitored: 0 online, 0 offline Unmonitored: 0 online, 2 offline]",
    );
    Dami.close();
  },
});
