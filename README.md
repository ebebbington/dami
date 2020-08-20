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

DAMI (Deno Asterisk Manager Interface) is an AMI client for Deno. It acts as an AMI client, and connects to your AMI on your Asterisk PBX. You can send any type of events to the AMI (through the [AMI API](https://www.voip-info.org/asterisk-manager-api/), as well as listen on the events your AMI sends. It is up to you on how you handle events, for example, to send a WebSocket message to a client when a call hangs up. See below on how this all works.

## How Does DAMI Work

DAMI can connect (using Deno) to an Asterisk AMI, and can start sending events, for example: logging in, then retrieving sip peers. All the logic to construct and send the messages is handled by DAMI, all you need to do is specify an action name and data. The same is said for receiving messages - you just need to create a listener for that event.

To clarify, **DAMI does not modify the data sent back from your AMI**, DAMI does convert values to integers *if it can*, but you can safely know what you see as the response of an event for the AMI API, is exactly what you receive, but in key value pairs. One minor exception is the `Output` property. This is an array containing each output line. This is currently being looked into to improve.

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
Dami.to("Originate", {
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

And if the `PeerEntry` event responds with the following data:

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

The data returned from DAMI will look like:

```typescript
Dami.on("PeerEntry", (data: DAMIData) => {
 console.log(data) // { Event: "PeerEntry", Channeltype: "SIP", ObjectName: 9915057, ... }
})
Dami.to("SIPPeers", {})
```

If an action doesn't require extra parameters (such as `SIPPeers`), then just pass an empty object:

```typescript
Dami.to("SIPPeers", {})
```

DAMI supports sending actions and receiving events, regardless of whether you triggered them or not. DAMI also supports executing commands, with the use of `triggerEvents`.

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

await Dami.listen() // Start listening for events. Required to register listeners

Dami.on("FullyBooted", (data: DAMIData)  => { // event for when you authenticate (or fail to)
  console.log("Auth response:")
  console.log(data)
})

Dami.on("Hangup", async (data: DAMIData) => {
  console.log("A hangup was made. Here is the data the AMI sent back:")
  console.log(data) // { Event: "Hangup", ... }
  await Dami.to("Originate",  {
    Channel: "sip/12345",
    Exten: 1234,
    Context: "default"
  })
})

// Send an action to the AMI to get an event
Dami.on("PeerEntry", (data: DAMIData) => { // If you have multiple peers, this cb will be called for each one
  console.log(data) // { ObjectName: 6002, Event: "PeerEntry", ... }
})
Dami.to("SIPPeers", {})
```

Alternatively, you can use `triggerEvent` to manually trigger an event, but it's main use case is for executing commands. For example, say you want 'peer entries' (needs an action of 'SIPPeers') or 'contents of a config file' (needs the `GetConfig` command):

```typescript
// Without trigger events
Dami.on("PeerEntry", (data) => {

})
Dami.to("SIPPeers", {})
// Not possible to send a command

// With using trigger events
const res = await Dami.triggerEvent("SIPPeers", { ... }) // can return the response
await Dami.triggerEvent("SIPPeers", { ... }, (data) => { // or you can pass a callback
  // data is an array with all peers
})
const extensionsContent: DAMIData = await Dami.triggerEvent("GetConfig", { Filename: "extensions.conf" })
```

## Examples

### Connect and Login

```typescript
const Dami = new DAMI({ hostname: "10.60.20.43", port: 5038 }) // ip/container name and port of the AMI
await Dami.connectAndLogin({ username: "admin", secret: "mysecret" }) // Connect and Login to the pbx
```

If you watch the stdout for your Asterisk shell, you should see a login message

### Send Actions

```typescript
// Send an action
Dami.to("Originate",  {
  Channel: "sip/12345",
  Exten: 1234,
  Context: "default"
})
// Actions that trigger events will also call the respective handler. Sending to `SIPPeers` will trigger a `PeerEntry` that the above will receive
Dami.to("SIPPeers", {})

// Another way can be `triggerEvent`. This must be used for events that don't have a specific event name, for example `GetConfig`
const extensionContent: DAMIData = await Dami.triggerEvent("GetConfig", { Filename: "extensions.conf" })
// or even use callbacks
await Dami.triggerEvent("GetConfig", { Filename: "extensions.conf" }, (data: DAMIData) => {
  
})
```

### Listen for Events

```typescript
// Listen on an event - can be triggered by `Dami.to("SIPPeers", {})`
Dami.on("PeerEntry", (data) => {

})
```

### Run Commands

This feature is very much in it's early stages, and doesn't really work as expected. Although you can do:

```typescript
Dami.to("Command", {
  Command: "sip show peers"
})
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

### `DAMI.to(eventName: string, data: DAMIData): Promise<void>`

Sends an event to the AMI, with data

```typescript
await Dami.to("Originate",  {
  Channel: "sip/12345"
  Exten: 1234
  Context: "default"
}
```
Resolves to:
```
Action: Originate
Channel: sip/12345
Exten: 1234
Context: Default
```

### `DAMI.on(eventName: string, cb: (data: DAMIData) => void): void`

Register and listen for an event - DAMI will push this into a map. The action is also included in `data`. When DAMI receives an event that matches a registered listener, it will call the callback.

```typescript
Dami.on("Hangup", (data) => {
  const action = data["Action"]; // "Hangup"
  // Do what you need to do here
})
```

### `DAMI.triggerEvent(actionName: string, data: DAMIData, cb?: (data: DAMIData) => void): Promise<null|DAMIData>`

Manually trigger events and get the response on that very line of code, mainly used for events sent by Asterisk that doesn't return a `Event` field.

In cases where multiple data blocks can be sent back from Asterisk instead of one single response, for example for `GetConfig`, DAMI will combine all responses into a single object

```typescript
const res: DAMIData = await Dami.triggerEvent("GetConfig", { Filename: "sip.conf"})
// or
await Dami.triggerEvent("GetConfig", { Filename: "sip.conf"}, (data: DAMIData) => {

})
```

### `DAMI.listen(): Promise<void>`

Start listening to the AMI events using the DAMI client. When a message is received, DAMI will check if the event name matches a registered listener (`Dami.on(...)`), and if it does, it will invoke the callback

```typescript
Dami.listen()
```
