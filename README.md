<p align="center">
  <img height="200" src="https://raw.githubusercontent.com/ebebbington/dami/master/dami-logo.png" alt="DAMI logo">
  <h1 align="center">DAMI</h1>
</p>
<p align="center">
  <a href="https://github.com/ebebbington/dami/actions">
    <img src="https://img.shields.io/github/workflow/status/ebebbington/dami/master?label=Tests">
  </a>
  <a href="https://github.com/ebebbington/dami/releases">
    <img src="https://img.shields.io/github/release/ebebbington/dami.svg?color=bright_green&label=latest">
  </a>
  <a href="https://github.com/ebebbington/dami/actions">
    <img src="https://img.shields.io/github/workflow/status/ebebbington/dami/CodeQL?label=CodeQL">
  </a>
  <a href="https://sonarcloud.io/dashboard?id=ebebbington_dami">
    <img src="https://sonarcloud.io/api/project_badges/measure?project=ebebbington_dami&metric=alert_status">
  </a>
</p>

---

## Table of Contents

- [What Is DAMI](#what-is-dami)
- [Quickstart](#quickstart)
- [Examples](#examples)
  - [Ping](#ping)
  - [Get Authentication Response](#get-authentication-response)
  - [Send A Command](#send-a-command)
  - [Listen For Events](#listen-for-events)
  - [Send An Action](#send-an-action)
  - [Remove a Listener](#remove-a-listener)
- [API Documentation](#api-documentation)

## What Is DAMI

DAMI (Deno Asterisk Manager Interface) is an AMI client for Deno, to interact
with the AMI on your Asterisk PBX.

DAMI supports sending every action, and capable of handling every event outlined
in the [AMI API](https://www.voip-info.org/asterisk-manager-api/.

The data DAMI will return to you is exactly what Asterisk would, but objects
consisting of key/value pairs in an array. For example, take the `Originate`
action. From Asterisks' documentation, they outline it requires the following
data:

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
  ActionID: "ABC45678901234567890",
});
```

Take the `FullyBooted` event, this is what Asterisk outlines it should contain:

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

DAMI would return it like:

```typescript
{
  Event: "FullyBooted",
  Privilege: "system,all",
  Uptime: 15203,
  LastReload: 15203,
  Status: "Fully Booted",
  Response: "Success",
  Message: "Authentication accepted"
}
```

## QuickStart

```typescript
import { Action, DAMI, Event } from "https://deno.land/x/dami@v4.1.1/mod.ts";
import type { Action, Event } from "https://deno.land/x/dami@v4.1.1/mod.ts";

const myPbx = {
  hostname: "127.0.0.1", // IP of your pbx, or container name if using docker, eg "asterisk_pbx"
  port: 5058, // Port of your pbx,
  logger: true, // defaults to true, enables logging from DAMI
  // certFile: "./path/to/cert", // pass in to enable tls
};
const myUser = {
  username: "user",
  secret: "mysecret",
};

const Dami = new DAMI(myPbx);

// As well as `connect()` returning the fully booted event, if a listener has been created beforehand, then it will also be called
Dami.on("FullyBooted", (event) => {
});

// Will wait to connect and authenticate with the AMI, no need for callbacks or event listeners!
const authResponse = await Dami.connect(myUser); // If authentication doesn't match, an error will be thrown here. Returns an array containing two objects: the auth response and FullyBooted event

// Send action
await Dami.to("Originate", {
  Channel: "sip/12345",
  Exten: 1234,
  Context: "default",
});
```

## Examples

### Ping

```typescript
import { DAMI } from "https://deno.land/x/dami@v4.1.1/mod.ts";
import type { Action, Event } from "https://deno.land/x/dami@v4.1.1/mod.ts";
const ami = {
  hostname: "0.0.0.0",
  port: 5038,
};
const Dami = new Dami(ami);
const user = {
  username: "admin",
  secret: "mysecret",
};
await Dami.connect(user);
const pong = await Dami.ping();
assert(pong);
```

### Get Authentication Response

```typescript
import { Action, DAMI, Event } from "https://deno.land/x/dami@v4.1.1/mod.ts";
import type { Action, Event } from "https://deno.land/x/dami@v4.1.1/mod.ts";

const ami = {
  hostname: "0.0.0.0",
  port: 5038,
};
const Dami = new Dami(ami);
const user = {
  username: "admin",
  secret: "mysecret",
};

// If a listener is created, then it will also be called, alongside the same result being returned from `.connect()`
Dami.on("FullyBooted", (event) => {
});

const res = await Dami.connect(user);
console.log("Are we connected: " + Dami.connected);
console.log(res);
// [
//   {
//     Response: "Success",
//     Message: "Authentication accepted"
//   },
//   {
//     Event: "FullyBooted",
//     Privilege: "system,all",
//     Uptime: 39672,
//     LastReload: 39672,
//     Status: "Fully Booted"
//   }
// ]
```

### Send a Command

The `Output` property is only present for `Command`s.

```typescript
import { Action, DAMI, Event } from "https://deno.land/x/dami@v4.1.1/mod.ts";
import type { Action, Event } from "https://deno.land/x/dami@v4.1.1/mod.ts";

const ami = {
  hostname: "0.0.0.0",
  port: 5038,
};
const Dami = new Dami(ami);
const user = {
  username: "admin",
  secret: "mysecret",
};
await Dami.connect(user);
const command = await Dami.to("Command", {
  Command: "sip show peers",
});
console.log(command[0]["Output"]);
```

### Listen for Events

```typescript
import { Action, DAMI, Event } from "https://deno.land/x/dami@v4.1.1/mod.ts";
import type { Action, Event } from "https://deno.land/x/dami@v4.1.1/mod.ts";

const ami = {
  hostname: "0.0.0.0",
  port: 5038,
};
const Dami = new Dami(ami);
const user = {
  username: "admin",
  secret: "mysecret",
};
await Dami.connect(user);
Dami.on("Hangup", (event: Event) => {
  // ...
});
```

### Send An Action

```typescript
import { Action, DAMI, Event } from "https://deno.land/x/dami@v4.1.1/mod.ts";
import type { Action, Event } from "https://deno.land/x/dami@v4.1.1/mod.ts";

const ami = {
  hostname: "0.0.0.0",
  port: 5038,
};
const Dami = new Dami(ami);
const user = {
  username: "admin",
  secret: "mysecret",
};
await Dami.connect(user);
const peerEntries = await Dami.to("SIPPeers", {});
console.log(peerEntries);
// [
//   {
//     Response: "Success",
//     ActionID: 1,
//     EventList: "start",
//     Message: "Peer status list will follow"
//   },
//   {
//     Event: "PeerEntry",
//     ActionID: 1,
//     Channeltype: "SIP",
//     ObjectName: 6001,
//     ChanObjectType: "peer",
//     IPaddress: "172.18.0.1",
//     IPport: 59588,
//     Dynamic: "yes",
//     AutoForcerport: "yes",
//     Forcerport: "yes",
//     AutoComedia: "no",
//     Comedia: "no",
//     VideoSupport: "no",
//     TextSupport: "no",
//     ACL: "no",
//     Status: "Unmonitored",
//     RealtimeDevice: "no",
//     Description: 0,
//     Accountcode: 0
//   },
//   {
//     Event: "PeerEntry",
//     ActionID: 1,
//     Channeltype: "SIP",
//     ObjectName: 6002,
//     ChanObjectType: "peer",
//     IPaddress: "172.18.0.1",
//     IPport: 40772,
//     Dynamic: "yes",
//     AutoForcerport: "yes",
//     Forcerport: "yes",
//     AutoComedia: "no",
//     Comedia: "no",
//     VideoSupport: "no",
//     TextSupport: "no",
//     ACL: "no",
//     Status: "Unmonitored",
//     RealtimeDevice: "no",
//     Description: 0,
//     Accountcode: 0
//   },
//   { Event: "PeerlistComplete", ActionID: 1, EventList: "Complete", ListItems: 2 }
// ]
```

### Remove a Listener

Whilst you can create listeners, you can also remove them if you wish to. This
means that your listener will be deleted, and it will no longer handle the
events sent by Asterisk, for that event name

```typescript
Dami.on("PeerStatus", (event: Event) => {
});
//  Maybe somewhere down the line, you would like to stop listening:
Dami.removeListener("PeerStatus"); // Throws an error if no listener has been set for that event name
Dami.removeListener("Hello"); // Will throw an error
Dami.removeListener("PeerStatus"); // Will now throw an error as the listener has already been removed
```

## API Documentation

See [here](https://doc.deno.land/https/deno.land/x/dami/mod.ts) for the API
documentation
