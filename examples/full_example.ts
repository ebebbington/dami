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
// Dami.on("FullyBooted", (data) => {
//   console.log("got fully booted");
//   console.log(data);
// });
const z = await Dami.connect(auth);
console.log(z)
// Dami.on("PeerEntry", (data) => {
//   console.log(data)
// })

// const val = await Dami.to("SIPPeers", {
//   ActionID: "23"
// })
// await Dami.to("Command", {
//   Command: "sip show channels",
//   ActionID: 999,
// }, (data) => {
//   console.log("sip show channels got data");
//   console.log(data);
// });
// const a = await Dami.to("Command", {
//   Command: "sip show peers",
//   ActionID: 1235,
// })
// console.log('got cmd output:')
// console.log(a)
// }, (event) => {
//   console.log('got command')
//   console.log(event)
// })
//
const b = await Dami.to("SIPPeers", {
  ActionID: 189,
})
console.log('got peers output:')
console.log(b)
// await Dami.to("GetConfig", {
//   Filename: "sip.conf",
//   ActionID: 2345,
// }, (data) => {
//   console.log("get config got data");
//   console.log(data);
// });
//console.log(val)
//const val2 = await Dami.to("GetConfig", { Filename: "sip.conf", ActionID: 2 })

    // [
    //   {
    //     Response: "Success",
    //     Message: "Authentication accepted"
    //   },
    //   {
    //       Event: "FullyBooted",
    //       Privilege: "system,all",
    //       Uptime: 39672,
    //       LastReload: 39672,
    //       Status: "Fully Booted"
    //     }
    // ]

