<p align="center">
  <img height="200" src="https://raw.githubusercontent.com/ebebbington/dami/master/dami-logo.png" alt="DAMI logo">
  <h1 align="center">DAMI</h1>
</p>
<p align="center">
  <a href="https://github.com/ebebbington/dami/actions">
    <img src="https://img.shields.io/github/workflow/status/ebebbington/dami/master?label=ci">
  </a>
  <a href="https://github.com/drashland/dami/releases">
    <img src="https://img.shields.io/github/release/ebebbington/dami.svg?color=bright_green&label=latest">
  </a>
</p>

---

## Table of Contents
- [What Is DAMI](#what-is-dami)
- [Projects Using DAMI](#projects-using-dami)
- [Quickstart](#quickstart)
- [Examples](#examples)
- [Documentation](#documentation)

## What Is DAMI

DAMI (Deno Asterisk Manager Interface) is an AMI client for Deno. It acts as an AMI client, and connects to your AMI on your Asterisk PBX. You can send any type of actions to the AMI (through the [AMI API](https://www.voip-info.org/asterisk-manager-api/), as well as listen on the events your AMI sends. It is up to you on how you handle events, for example, to send a WebSocket message to a client when a call hangs up. See below on how this all works.

The data DAMI will return to you is exactly what Asterisk would, but objects consisting of key/value pairs inan array.

For example, take the `Originate` action. From Asterisks' documentation, they outline it requires the following data:

```
Action: Originate
Channel: SIP/101test
Context: default
Exten: 8135551212
Priority: 1
Callerid: 3125551212
Timeout: 30000
Variable: var1=23|var2=24|var3=25
ActionID: ABC45678901234567890
```

How you would send this action would be like so:

```typescript
await Dami.to("Originate", {
  Channel: "SIP/101test",
  Context: "default",
  Exten: 8135551212,
  Priority: 1,
  Callerid: 3125551212,
  Timeout: 30000,
  Variable: "var1=23|var2=24|var3=25",
  ActionID: "ABC45678901234567890"
})
```

And the `FullyBooted` event will return:

```typescript
[{
  Event: "FullyBooted",
  Privilege : "system,all",
  Uptime: 15203,
  LastReload: 15203,
  Status: "Fully Booted",
  Response: "Success",
  Message: "Authentication accepted"
}]
```
<!--
```
Event: PeerEntry
Channeltype: SIP
ObjectName: 9915057
ChanObjectType: peer
IPaddress: 10.64.72.166
IPport: 5060
Dynamic: yes
Natsupport: no
ACL: no
Status: OK (5 ms)
```
-->

## Projects Using DAMI

- [Chatsterisk](https://github.com/ebebbington/chatsterisk/src/ami/app.ts) - My own personal learning project. It uses DAMI to aid in making SIP calls through the browser.

## QuickStart

```typescript
import { DAMI, Action, Event } from "https://deno.land/x/dami@v3.0.1/mod.ts";
import { DAMI, Action, Event } from "https://x.nest.land/dami@3.0.1/mod.ts";

const myPbx = {
  hostname: "127.0.0.1", // IP of your pbx, or container name if using docker, eg "asterisk_pbx"
  port: 5058, // Port of your pbx,
  logger: true // defaults to true, enables logging from DAMI
  // certFile: "./path/to/cert", // pass in to enable tls
}
const Dami = new DAMI(myPbx)

// Register your listeners for events
Dami.on("Hangup", (events: Event[]) => {
 // ...
})
Dami.on("FullyBooted", (events: Event[]) => {

})

// Connect and start listening
await Dami.connect(myUser)

// Send actions
await Dami.to("Originate",  {
  Channel: "sip/12345",
  Exten: 1234,
  Context: "default",
})
// or use a callback when you want to receive the event(s) an action sends
await Dami.to("SIPPeers", {}, (sipPeers: Event[]) => {
  console.log(event)
   // [
   //   {
   //     ...
   //   },
   //   {
   //     Event: "PeerEntry",
   //     ActionID: 12354,
   //     Channeltype: "SIP",
   //     ObjectName: 6002,
   //     ChanObjectType: "peer",
   //     IPaddress: "-none-",
   //     IPport: 0,
   //     Dynamic: "yes",
   //     AutoForcerport: "yes",
   //     Forcerport: "no",
   //     AutoComedia: "no",
   //     Comedia: "no",
   //      VideoSupport: "no",
   //     TextSupport: "no",
   //     ACL: "no",
   //     Status: "Unmonitored",
   //     RealtimeDevice: "no"
   //   }
   // }
})
// Also supports sending commands (note: you must use a callback here)
await Dami.to("Command", {
  Command: "sip show peers",
}, (event:  Event[]) => {
 console.log(event) // [ { Response: "Success",  ..., Output: ["Name/username    Host     ...", "6001      (Unspecified)     ...] } ]
})
```

## Documentation

See [here](https://doc.deno.land/https/deno.land/x/dami/mod.ts) for the API documentation
