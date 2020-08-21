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
- [How Does DAMI Work](#how-does-dami-work)
- [Projects Using DAMI](#projects-using-dami)
- [Quickstart](#quickstart)
- [Examples](#examples)
- [Documentation](#documentation)

## What Is DAMI

DAMI (Deno Asterisk Manager Interface) is an AMI client for Deno. It acts as an AMI client, and connects to your AMI on your Asterisk PBX. You can send any type of actions to the AMI (through the [AMI API](https://www.voip-info.org/asterisk-manager-api/), as well as listen on the events your AMI sends. It is up to you on how you handle events, for example, to send a WebSocket message to a client when a call hangs up. See below on how this all works.

## How Does DAMI Work

***For DAMI to work, inside your `manager.conf`, you must allow at least 2 connections (`allowMultipleLogins`)***

* DAMI can connect (using Deno) to an Asterisk AMI, and can start sending events, for example: logging in, then originating a call. All the logic to construct and send the messages is handled by DAMI, all you need to do is specify an action name and data. The same is said for receiving messages - you just need to create a listener for that event.

To clarify, what you see as response on Asterisk's AMI API docs, is what is returned, but is instead converted to key value pairs. DAMI does convert values to integers *if it can*, but you can safely know what you see as the response of an event for the AMI API, is exactly what you receive. One minor exception is the `Output` property. This is an array containing each output line.

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
const response: DamiData[] = await Dami.to("Originate", {
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
{
  Event: "FullyBooted",
  Privilege : "system,all",
  Uptime: 15203,
  LastReload: 15203,
  Status: "Fully Booted",
  Response: "Success",
  Message: "Authentication accepted"
}
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

If an action doesn't require extra parameters (such as `SIPPeers`), then just pass an empty object:

```typescript
const res = await Dami.to("SIPPeers", {})
```

DAMI supports sending actions and receiving events, regardless of whether you triggered them or not. DAMI also supports executing commands.

## Projects Using DAMI

- [Chatsterisk](https://github.com/ebebbington/chatsterisk/src/ami/app.ts) - My own personal learning project. It uses DAMI to aid in making SIP calls through the browser.

## QuickStart

```typescript
import { DAMI, DAMIData } from "https://deno.land/x/dami/mod.ts";

const myPbx = {
  hostname: "127.0.0.1", // IP of your pbx, or container name if using docker, eg "asterisk_pbx"
  port: 5058 // Port of your pbx,
  logger: true // defaults to true, enables logging from DAMI
}
const Dami = new DAMI(myPbx) // Create a new instance of DAMI

const myUser = {
  username: "admin", // username for authentication, resides inside your `manager.conf`
  secret: "mysecret" // secret for your user, also resides inside your `manager.conf`
}
await Dami.connectAndLogin(myUser) // Connect and Login to the pbx

await Dami.listen() // Start listening for events. Required to register listeners such as `Dami.on(...)`

// Register your listeners for events straight away
Dami.on("FullyBooted", async (data: DAMIData)  => { // event for when you authenticate (or fail to)
  console.log("Auth response:")
  console.log(data)
  await Dami.to("Originate",  {
    Channel: "sip/12345",
    Exten: 1234,
    Context: "default"
  })
})

// Send an action (and get a response) - `ActionID` must be passed in
const extensionsContent: DAMIData[] = await Dami.to("GetConfig", { Filename: "extensions.conf", ActionId: "custom id" }) // can return the response
await Dami.to("GetConfig", { Filename: "extensions.conf", ActionID: "custom id" }, (data: DAMIData[]) => { // or use a callback

})
```

## Examples

### Connect and Login

```typescript
const Dami = new DAMI({ hostname: "10.60.20.43", port: 5038 }) // ip/container name and port of the AMI
await Dami.connectAndLogin({ username: "admin", secret: "mysecret" }) // Connect and Login to the pbx
```

If you watch the stdout for your Asterisk shell, you should see a login message

### Send Actions 

Send a single action to the AMI. If an action triggers an event, the event response will be returned

```typescript
// Return a value
const res: DAMIData[] = await Dami.to("Originate",  {
  Channel: "sip/12345",
  Exten: 1234,
  Context: "default",
  ActionID: "custom id"
})
// or use a  callback
await Dami.to("SIPPeers", { ActionID: "custom id" }, (data: DAMIData[]) => {
  
})
```

The `data`  for the `SIPPeers` callback would be:

```
[
  {
    Response: "Success",
    ActionID: 12354,
    EventList: "start",
    Message: "Peer status list will follow"
  },
  {
    Event: "PeerEntry",
    ActionID: 12354,
    Channeltype: "SIP",
    ObjectName: 6001,
    ChanObjectType: "peer",
    IPaddress: "-none-",
    IPport: 0,
    Dynamic: "yes",
    AutoForcerport: "yes",
    Forcerport: "no",
    AutoComedia: "no",
    Comedia: "no",
    VideoSupport: "no",
    TextSupport: "no",
    ACL: "no",
    Status: "Unmonitored",
    RealtimeDevice: "no"
  },
  {
    Event: "PeerEntry",
    ActionID: 12354,
    Channeltype: "SIP",
    ObjectName: 6002,
    ChanObjectType: "peer",
    IPaddress: "-none-",
    IPport: 0,
    Dynamic: "yes",
    AutoForcerport: "yes",
    Forcerport: "no",
    AutoComedia: "no",
    Comedia: "no",
    VideoSupport: "no",
    TextSupport: "no",
    ACL: "no",
    Status: "Unmonitored",
    RealtimeDevice: "no"
  },
  { Event: "PeerlistComplete", ActionID: 12354, EventList: "Complete", ListItems: 2 }
]
```

### Listen for Events

Listen for any events that the AMI sends. Listeners must be created right after `await Dami.listen()`

```typescript
// Listen on an event. When DAMI receives a response from Asterisk, it will call the listener if a listener name matches the event name in the response
Dami.on("FullyBooted", (data: DAMIData) => {

})
```

### Run Commands

DAMI also supports running commands.

```typescript
const response = await Dami.to("Command", {
  Command: "sip show peers",
  ActionID: "custom id"
})
console.log(response)
// [
//   {
//      Response: "Success",
//      ...,
//      Output: [
//        "Name/username     Host               Dyn     ...",
//        "6001              (Unspecified)      D       ...",
//        "..."
//      ]
//   }
// ]
```

## Documentation

### `interface DAMIData`

```typescript
const obj: DAMIData = {
  // any key value pairs, where value can be a number string, or array of strings
}
```

A property value would only be an array of strings when there is "output" in the response, for example when sending a `SIPPeers` action, you get `Output` in the event response.

### `new DAMI(configs:  IConfigs): DAMI`

Create an instance of the DAMI class. This does not run any logic, but just sets up the properties. 

```typescript
const Dami = new DAMI({
  hostname: "127.0.0.1",
  port: 3000,
  logger: false // disables the DAMI logger. Disabled by default
```

### `DAMI.conn: Deno.conn`

The connection object to the AMI

### `DAMI.close(): void`

Closes the connection to the AMI

```typescript
Dami.close()
```

### `DAMI.connectAndLogin({ username: string, secret: string }): Promise<void>`

Connects to your AMI, using the configs passed into the `DAMI` constructor. Once connected, logs in using the auth data passed in

```typescript
await Dami.connectAndLogin({ username: "admin", secret: "mysecret" })
```

### `DAMI.to(eventName: string, data: DAMIData): Promise<[]|DAMIData[]>`

Sends an action to the AMI, with data if needed, and get a response. The response if a bonus, if you need it.

**The `ActionID` is required*

```typescript
const response = await Dami.to("Originate",  {
  Channel: "sip/12345",
  Exten: 1234,
  Context: "default",
  ActionID: "custom id"
})
```
When this message is sent to the AMI, it resolves to:
```
Action: Originate
Channel: sip/12345
Exten: 1234
Context: default
ActionID: custom id
```

### `DAMI.on(eventName: string, cb: (data: DAMIData) => void): void`

Register and listen for an event - DAMI will push this into a map. The action is also included in `data`. When DAMI receives an event that matches a registered listener, it will call the callback.

```typescript
Dami.on("Hangup", (data) => {
  const action = data["Action"]; // "Hangup"
  // Do what you need to do here
})
```

### `DAMI.listen(): Promise<void>`

Start listening to the AMI events using the DAMI client. When a message is received, DAMI will check if the event name matches a registered listener (`Dami.on(...)`), and if it does, it will invoke the callback

```typescript
Dami.listen()
```

### `DAMI.ping(): Promise<boolean>`

Ping the AMI connection. Returns true or false based on if the connection  was successful

```typescript
const pong = await Dami.pong() // true or false
```
