import { DAMI } from "../src/dami.ts";

const ami = {
  hostname: "0.0.0.0",
  port: 5038,
  logger: true,
};

const auth = {
  username: "admin",
  secret: "mysecret",
};

const Dami = new DAMI(ami);
await Dami.connectAndLogin(auth);
Dami.on("FullyBooted", (data) => {
  console.log("got fully booted");
  console.log(data);
});
// Dami.on("PeerEntry", (data) => {
//   console.log(data)
// })
await Dami.listen();

// const val = await Dami.to("SIPPeers", {
//   ActionID: "23"
// })
await Dami.to("Command", {
  Command: "sip show channels",
  ActionID: 999,
}, (data) => {
  console.log("sip show channels got data");
  console.log(data);
});
await Dami.to("Command", {
  Command: "sip show peers",
  ActionID: 1235,
}, (data) => {
  console.log("command  got data");
  console.log(data);
});
// }, (event) => {
//   console.log('got command')
//   console.log(event)
// })
//
await Dami.to("SIPPeers", {
  ActionID: 189,
}, (data) => {
  console.log("sippeers got data");
  console.log(data);
});
await Dami.to("GetConfig", {
  Filename: "sip.conf",
  ActionID: 2345,
}, (data) => {
  console.log("get config got data");
  console.log(data);
});
//console.log(val)
//const val2 = await Dami.to("GetConfig", { Filename: "sip.conf", ActionID: 2 })
