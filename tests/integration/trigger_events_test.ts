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

const expectedSipConfResponse = {
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
  name: "Can trigger an event and calls the callback if one is passed in",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn(): Promise<void> {
    const Dami = new DAMI(ami);
    await Dami.connectAndLogin(auth);
    await Dami.listen();
    let response: DAMIData = {};
    sleep(2000); // simulate some other stuff happening before the code triggers an event, such as maybe a POST req triggers one
    await Dami.triggerEvent("GetConfig", { Filename: "sip.conf" }, (data) => {
      response = data;
      Rhum.asserts.assertEquals(data, expectedSipConfResponse);
    });
    sleep(4000); // simulate some other stuff happening before the code triggers an event, such as maybe a POST req triggers one
    await setTimeout(() => {
      Rhum.asserts.assertEquals(response, expectedSipConfResponse);
      Dami.close();
    }, 5000);
  },
});

Deno.test({
  name:
    "Can trigger an event and returns the response if no callback is passed in",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn(): Promise<void> {
    const Dami = new DAMI(ami);
    await Dami.connectAndLogin(auth);
    await Dami.listen();
    sleep(2000); // simulate some other stuff happening before the code triggers an event, such as maybe a POST req triggers one
    const res = await Dami.triggerEvent("GetConfig", { Filename: "sip.conf" });
    // It should contain EVERYTHING, even if asterisk sent multiple events
    Rhum.asserts.assertEquals(res, expectedSipConfResponse);
    Dami.close();
  },
});

Deno.test({
  name: "Can handle user errors for example error responses",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn(): Promise<void> {
    const Dami = new DAMI(ami);
    await Dami.connectAndLogin(auth);
    await Dami.listen();
    sleep(2000); // simulate some other stuff happening before the code triggers an event, such as maybe a POST req triggers one
    const res = await Dami.triggerEvent("GetConfig", { Filename: "rtp.conf" });
    // It should contain EVERYTHING, even if asterisk sent multiple events
    Rhum.asserts.assertEquals(
      res,
      { Response: "Error", "Message": "Config file has invalid format" },
    );
    Dami.close();
  },
});

Deno.test({
  name: "Doesnt interfere with `listen`",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn(): Promise<void> {
    const Dami = new DAMI(ami);
    await Dami.connectAndLogin(auth);
    await Dami.listen();
    const peerEntryResults: DAMIData[] = [];
    Dami.on("PeerEntry", (data) => {
      peerEntryResults.push(data);
    });
    sleep(2000); // simulate some other stuff happening before the code triggers an event, such as maybe a POST req triggers one
    const res = await Dami.triggerEvent("GetConfig", { Filename: "rtp.conf" });
    Rhum.asserts.assertEquals(
      res,
      { Response: "Error", "Message": "Config file has invalid format" },
    );
    await Dami.to("SIPPeers", {});
    sleep(10000);
    await setTimeout(() => {
      Rhum.asserts.assertEquals(peerEntryResults.length, 2);
      Rhum.asserts.assertEquals(peerEntryResults[0].ObjectName, 6001);
      Rhum.asserts.assertEquals(peerEntryResults[1].ObjectName, 6002);
      Dami.close();
    }, 3000);
  },
});

// HOW DO I KEEP A CONSTANT LISTENER, AS WELL AS ANOTHER LISTENER I CAN ESSENTIALLY MAKE QUERIES TO. ONCE WE TRY TO SEND MESSAGE AFTER TRIGGER, NO LISTENERS SEEM TO GET THEM
