<p align="center">
  <img height="200" src="./dami-logo.png" alt="DAMI logo">
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
- [Documentation](#documentation)

## What Is DAMI

DAMI (Deno Asterisk Manager Interface) is an AMI client for Deno. It acts as a client, and connects to your AMI on your Asterisk PBX. You can send any type of events to the AMI (through the [AMI API](https://www.voip-info.org/asterisk-manager-api/), as well as listen on the events your AMI sends. It is up to you on how you handle events, for example, to send a WebSocket message to a client when a call hangs up. See below on how this all works.

## How Does DAMI Work

DAMI can connect (using Deno) to an Asterisk AMI, and can start sending events, for example logging in, then retreiving sip peers. All the logic to send the messages is handled by DAMI, all you need to do is specify an event name and data. The same is said for receiving messages - you just need to create a listener for that event.

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

Dami.on("FullyBooted", (data: DAMIData)  => { // event for when you authenticate
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

### `DAMI.listen(): Promise<void>`

Start listening to the AMI events using the DAMI client. When a message is received, DAMI will check if the event name matches a registered listener (`Dami.on(...)`), and if it does, it will invoke the callback

```typescript
Dami.listen()
```
