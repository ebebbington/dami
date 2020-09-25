/**
 * Hostname of the server to connect to
 * Port of the server to connect to
 */
interface IConfigs {
  hostname?: string;
  port: number;
  logger?: boolean;
  certFile?: string;
}

let nextActionId = 0

let lastActionID = 0;

type LogLevels = "error" | "info" | "log";

export type Event = {[key: string]: string | number} & { Output?: string[]}

export type Action = {[key: string]: string | number }

const defaultConfigs = {
  hostname: "localhost",
  port: 5038,
  logger: true,
};

export class DAMI {
  /**
   * Constructor configs, to connect to the AMI
   */
  private readonly configs: IConfigs;

  /**
   * Used for constantly listen on events (such as Hangup)
   */
  public conn: Deno.Conn | null = null;

  /**
   * Holds all events user wishes to listen on, where the
   * index is the action id (if trigger events with `to`),
   * or the event name when simple listening
   */
  private listeners: Map<number | string, (event: Event[]) => void> = new Map();

  /**
   * Collection of responses for a given action id
   * Supports gathering events triggered by actions, and
   * used to call the related listener
   *
   *     const listener = this.listeners.get(actionId)
   *     cost responses = this.responses.get(actionId)
   *     await listener(responses)
   */
  private responses: Map<number, Event[]> = new Map()

  /**
   * @param configs - Hostname and port of the AMI to connect to
   */
  constructor(configs: IConfigs = defaultConfigs) {
    this.configs = configs;
  }

  /**
   * Closes the connection
   */
  public close() {
    this.log("Closing connection", "info");
    try {
      this.conn!.close();
    } catch (err) {
      // dont  need to do anything
    }
  }

  /**
   * Connect to the server, and authenticate (login)
   *
   * @param auth - Username and secret to use in the login event
   */
  public async connectAndLogin(
    auth: { username: string; secret: string },
  ): Promise<void> {
    if (this.conn) {
      throw new Error("A connection has already been made");
    }
    // Connect
    if (this.configs.certFile) {
      this.conn = await Deno.connectTls({
        hostname: this.configs.hostname,
        port: this.configs.port,
        certFile: this.configs.certFile,
      });
    } else {
      this.conn = await Deno.connect({
        hostname: this.configs.hostname,
        port: this.configs.port,
      });
    }

    this.log(
      `Connected to ${this.configs.hostname}:${this.configs.port}`,
      "info",
    );

    // Login
    const loginMessage = this.formatAMIMessage("Login", auth);
    await this.conn!.write(loginMessage);

    return;
  }

  /**
   * Ping the ami
   *
   * @returns Whether we we got a pong or not
   */
  // public async ping(actionID: number, callback: (event: Event) => void): Promise<void> {
  //   await this.to("ping", { ActionID: actionID }, callback);
  //   // const pong = Array.isArray(response) && response.length === 1 &&
  //   //   (response[0]["Response"] === "Success" || response[0]["Ping"] === "Pong");
  //   // return pong;
  // }

  /**
   * Send a message/event to the AMI
   *
   * @param actionName - The name of the event
   * @param data - The data to send across, in key value pairs
   * @param [cb] - If passed in, will call the callback instead of returning the response
   */
  public async to(
    actionName: string,
    data: Action,
    cb?: (data: Event[]) => void,
  ): Promise<void> {

    // Logging purposes
    this.log("Sending event for: " + actionName, "info");
    this.log(JSON.stringify(data), "info");

    const id = this.generateActionId()

    // Save the callback
    if (cb) {
      this.listeners.set(id, cb)
    }

    // Write message
    data["ActionID"] = id
    const message = this.formatAMIMessage(actionName, data);
    await this.conn!.write(message);
  //
  //   // Iterate over the responses until we get something we want.
  //   // The reason for this is because, asterisk just sends crap sometimes, it might
  //   // send the actual response we want on the first try, but then
  //   // other times it'll send the FullyBooted event, or just the "Asterisk Call Line manage/" line
  //   let events: Event[] = [];
  //   const iterator = Deno.iter(this.conn!);
  //   const getRes = async () => {
  //     const { value, done } = (await iterator.next())
  //     const response = this.formatAMIResponse(value)
  //     response.forEach(res => {
  //       events.push(res)
  //     })
  //   }
  //
  //   // while events doesn't have the action-related event, keeepe fetching
  //   while (events.filter(event => event["Event"] === actionEventPairs[actionName.toLowerCase()]).length < 1) {
  //     await getRes()
  //   }
  //
  //   console.log(events)
  //
  //   // If response has fully booted event, strip it
  //   events = events.filter(event => {
  //     return event["Message"] !== "Authentication accepted" && event["Event"] !== "FullyBooted"
  //   })
  //   // Then strip any unwanted event stuff, for example on sending SIPPEERS action, we can get responses with { EventList: "Complete" }, but they don't provide anything the user would want
  //   events = events.filter(event => {
  //     return event.hasOwnProperty("EventList") === false
  //   })
  //   // And also only get responses with an actionid, because ive seen when we've reached here, an object is preset i events thats just { Message: "Peer status list will follow: }
  //   events = events.filter(event => {
  //     return event["ActionID"] === Number(data["ActionID"])
  //   })
  //   // And also sometimes a resulting object is just an eveennt and actionid
  //   events = events.filter(event => {
  //     const pointlessEvent = Object.keys(event).length === 2 && event.hasOwnProperty("Event") && event.hasOwnProperty("ActionID")
  //     return pointlessEvent !== true
  //   })
  //
  //
  //   //
  //   //         // Check if error responses, only for logging purposes
  //   //         if (
  //   //           Array.isArray(formattedResponse) && formattedResponse.length &&
  //   //           formattedResponse[0]["Response"] === "Error"
  //   //         ) {
  //   //           //@ts-ignore It  throws an error about the types, because we 'havent checked if its an array'... i mean ffs, we have but the tsc just hates us
  //   //           const errorMessage = formattedResponse[0]["Message"]
  //   //             ? // annoyingly not always present due to the event splitting
  //   //               formattedResponse[0]["Message"].toString()
  //   //             : "An unknown error occurred when trying to authenticate";
  //   //           this.log(errorMessage, "error");
  //   //         } else if (
  //   //           formattedResponse && !Array.isArray(formattedResponse) &&
  //   //           formattedResponse["Response"]
  //   //         ) {
  //   //           if (
  //   //             formattedResponse["Response"] &&
  //   //             formattedResponse["Response"] === "Error"
  //   //           ) {
  //   //             //@ts-ignore It  throws an error about the types, because we 'havent checked if its an array'... i mean ffs, we have but the tsc just hates us
  //   //             const errorMessage = formattedResponse["Message"]
  //   //               ? // annoyingly not always present due to the event splitting
  //   //                 formattedResponse["Message"].toString()
  //   //               : "An unknown error occurred when trying to authenticate";
  //   //             this.log(errorMessage, "error");
  //   //           }
  //   //         }
  //   //       }
  //   //     }
  //   //   }
  //
  //   // // OLD: Now get the responses where it matches the passed in ActionID
  //   // // NEW: Now get the responses where it doesn't contain the auth event
  //   // relatedResponses = responses.filter((response) =>
  //   //   response["Message"] !== "Authentication accepted"
  //   // );
  //   // relatedResponses = relatedResponses.filter((response) =>
  //   //   response["Event"] !== "FullyBooted"
  //   // );
  //   //
  //   // // As events can be separated at times (asterisk sends them in chunks), but still part of a single event, we combine objects before each other
  //   // const newResponses: DAMIData[] = [{}];
  //   // let onObjWithId = false;
  //   // relatedResponses.forEach((response, i) => {
  //   //   onObjWithId = !!response["ActionID"];
  //   //   if (onObjWithId === false) {
  //   //     Object.keys(response).forEach((key) => {
  //   //       newResponses[newResponses.length - 1][key] = response[key];
  //   //     });
  //   //   } else if (onObjWithId === true && newResponses.length > 1) { // create new obj if
  //   //     newResponses.push({});
  //   //     Object.keys(response).forEach((key) => {
  //   //       newResponses[newResponses.length - 1][key] = response[key];
  //   //     });
  //   //   } else if (onObjWithId && newResponses.length === 1) { // for when the first object in relatedresponses has an id, but we haven't yet added to newresponses (dont create a new item in the  array yet)
  //   //     if (newResponses[newResponses.length - 1]["ActionID"]) { // Because say the item we are on has id, and prev has id, but the currennt length  of newresponses is 1, we need to create a new obj for this
  //   //       newResponses.push({});
  //   //     }
  //   //     Object.keys(response).forEach((key) => {
  //   //       newResponses[newResponses.length - 1][key] = response[key];
  //   //     });
  //   //   }
  //   // });
  //   // relatedResponses = newResponses;
  //   //
  //   // // If the action ID is only present on one object, then the WHOLE array is a single response (event), so combine it like so
  //   // const onlyOneActionIdPresent =
  //   //   relatedResponses.filter((response) => !!response["ActionID"]).length ===
  //   //     1;
  //   // if (onlyOneActionIdPresent) {
  //   //   const newResponse: DAMIData[] = [{}];
  //   //   relatedResponses.forEach((response) => {
  //   //     Object.keys(response).forEach((key) => {
  //   //       newResponse[0][key] = response[key];
  //   //     });
  //   //   });
  //   //   relatedResponses = newResponse;
  //   // }
  //   //
  //
  //   // // Return the responses or call the callback
  //   if (cb) { // call callback
  //     await cb(events);
  //     return [];
  //   } else if (!cb) { // return response instead
  //     return events;
  //   }
  //   return [];
  }

  /**
   * Listen on a certain event from the AMI
   *
   * @param eventName - Event name to listen for
   * @param cb - Your callback, which is called with the AMI data
   */
  public on(eventName: string, cb: (data: Event[]) => void): void {
    this.listeners.set(eventName, cb);
  }

  /**
   * Listens for any events from the AMI and does ?? with them
   */
  public async listen(): Promise<void> {
    (async () => {
      try {
        console.table(this.conn)
        for await (const chunk of Deno.iter(this.conn!)) {
          if (!chunk) {
            this.log(
              "Invalid response from event received from the AMI. Closing connection",
              "error",
            );
            this.close();
            break;
          } else {
            this.log("Received event from the AMI", "info");
            const event = new TextDecoder().decode(chunk)
            await this.handleAMIResponse(event);
          }
        }
      } catch (e) {
        console.error(e)
        this.log(e.message, "error")
        //await this.listen()
      }
    })();
  }

  /**
   * Constructs the message we want to send through the connection, in
   * the correct format. When we write a message, it needs to be in the format of:
   *     "action: 'some value'\r\nkey: 'value'... etc"
   * This then needs to be converted to a Uint8Array (as required when sending through `Deno.connect`)
   *
   * @param actionName - The action name
   * @param data - The extra data to send with the action
   *
   * @returns The encoded message to write
   */
  private formatAMIMessage(actionName: string, data: Event): Uint8Array {
    let eventString = `action: ${actionName}\r\n`;
    Object.keys(data).forEach((key) => {
      eventString += `${key}: ${data[key]}\r\n`;
    });
    eventString += `\r\n`;
    return new TextEncoder().encode(eventString);
  }

  /**
   * Formats the event data from the AMI into a nice key value pair format
   *
   * @param message
   *
   * @returns A key value pair of all the data sent by the AMI
   */
  private formatAMIResponse(message: string): Event[] {
    function formatArrayIntoObject(arr: string[]): Event {
      arr = arr.filter((data) => data !== ""); // strip empty lines
      let responseObject: Event = {};
      // Create key value pairs from each line in the response
      arr.forEach((data) => { // data = "Something: something else"
        // If it has an "Output: ..." line, then there's a  chance there are multiple Output lines
        if (data.indexOf("Output: ") === 0) { // we do this because there are multiple "Output: " items returned (eg multiple items in the array), so when we do  `responseObj[key] = value`, it just overwrites the data
          // For example, data might come across as:
          // ["Output: Name/username         Host          Dyn",
          // "Output: 6001                  (Unspecified)  D"]
          const dataSplit = data.split(/: (.+)/); // only split first occurrence, as we can have data that is like: "Output: 2 sip peers [Monitored: ..."
          if (responseObject["Output"]) { // We have already added the output property
            if (
              typeof responseObject["Output"] !== "number" &&
              typeof responseObject["Output"] !== "string"
            ) {
              responseObject["Output"].push(dataSplit[1]);
            }
          } else { // create it
            responseObject["Output"] = [];
            responseObject["Output"].push(dataSplit[1]);
          }
        } else { // it's a event response
          const [name, value] = data.split(": ");
          if (!value) { // eg data = "Asterisk ..." (and not an actual property), so key is the whole line and value isnt defined
            return;
          }
          // If the value is a number, make it so
          if (!isNaN(Number(value))) {
            responseObject[name] = Number(value);
          } else {
            responseObject[name] = value;
          }
        }
      });
      return responseObject;
    }

    const response: string = message; // = "Response: Success\r\nMessage: ..."
    let dataArr: string[] = response.split("\n"); // = ["Response: Success\r", "Message: ..."]
    dataArr = dataArr.map((data) => data.replace(/\r/, "")); // remove \r characters, = ["Response: Success", "Message: ..."]

    // Because an event sent from asterisk can contain multiple blocks, for example (before splitting):
    //   Response: Success
    //   Message: Authentication accepted
    //
    //   Event: FullyBooted
    //   ...
    //
    //   Event: PeerEntry
    //   ...
    //
    //   Event: PeerEntry
    // We dont want to override the data, as this has become a list. So in these cases, when we split using "\n", an item in the array that is empty denotes a new section appears after,  so say there is an empty item in the array, it could mean there are 2 `PeerEntry` blocks
    const startOfNewSection = dataArr.indexOf("") !== -1 &&
      dataArr.indexOf("") !== (dataArr.length - 1); // last bit is mainly if data comes back like: `["...", "...", ""]`, where it has an empty index but isn't actually a new block
    if (startOfNewSection) { // the event has multiple sections, so we put it into an array instead
      const blocks: Array<Array<string>> = [];
      function loop(arr: string[]): void {
        if (arr[0] === "") { // has an empty 0th index, eg a 1+n section so  remove it
          arr.splice(0, 1);
        }

        // And if there are no truthy values, do nothing
        if (arr.filter((a) => a !== "").length === 0) {
          return;
        }

        if (arr.indexOf("") === -1) { // Reached the last section
          blocks.push(arr);
          return;
        }
        const otherSections = arr.splice(arr.indexOf(""));
        blocks.push(arr);
        loop(otherSections);
      }
      loop(dataArr);
      const responseArr: Array<Event> = [];
      blocks.forEach((block) => {
        const formattedBlock = formatArrayIntoObject(block);
        if (formattedBlock) {
          responseArr.push(formattedBlock);
        }
      });
      return responseArr;
    } else { //  It's a  single event block, so return an object
      const responseObject = formatArrayIntoObject(dataArr);
      if (Object.keys(responseObject).length === 0) return []
      return [responseObject];
    }
  }

  private generateActionId (): number {
    nextActionId++
    if (nextActionId === Number.MAX_SAFE_INTEGER || (nextActionId - 1) === Number.MAX_SAFE_INTEGER) {
      nextActionId = 1
    }
    return nextActionId
  }

  /**
   * Calls a listener with the responses by the action id
   * after 1 second. Givs enough time for `handleamirsponse` to
   * gather all the messages
   *
   * @param actionID - Key in listners and responses
   */
  private callListeners (actionID: number) {
    setTimeout(async () => {
      const responses = this.responses.get(actionID)
      let listener = this.listeners.get(actionID)
      if (!listener) {
        const event = responses!.find(response => response["Event"]);
        const eventName = event!["Event"]
        listener = this.listeners.get(eventName)
      }
      if (listener && responses) { // bloody tsc complaining it might be undefined...
        // try find an event for logging purposes
        const eventName = responses.find(response => response.hasOwnProperty("Event"));
        if (eventName) {
          this.log("Calling listener for " + eventName, "info")
        }
        await listener(responses)
        this.responses.delete(actionID);
      }
    }, 1500)
  }

  /**
   * Responsible for handling a response from the AMI, to call any listeners on the event name
   *
   * @param message - Response from AMI
   */
  private async handleAMIResponse(message: string): Promise<void> {
    const events = this.formatAMIResponse(message);

    if (!events.length) {
      return
    }

    // Special case for when failed authentication
    if (lastActionID === 0 && events[0]["Response"] === "Error" || events[0]["Response"] === "Error" && events[0]["Message"] === "Authentication failed") {
      throw new Error(`Authentication failed. Unable to login.`)
    }

    // And here is how we solve the scattered events the ami sends.
    // Mainly, this solves things like getconfig, where part of a message is sent
    // with an action id, and then other parts are sent without an action id so it's hard
    // to figure out what messages are part of the same event
    // So we pretty much build up the responses, and call the callback after 1 second (1s being enough time to gt all messages)
    for (let i = 0; i < events.length; i++) {
      if (!lastActionID && events[1] && events[1]["Event"] === "FullyBooted") { // first event, which is always auth event
        const ev = {
          ...events[0],
          ...events[1]
        }
        const listener = this.listeners.get("FullyBooted");
        if (listener) {
          await listener([ev])
        }
        events.splice(0, 2)
        i = -1 // to start the loop from  0 now e've removed some elems
      } else if (events[i]["ActionID"] && !this.responses.has(Number(events[i]["ActionID"]))) { // new section, an event asterisk sent back when triggered
        this.responses.set(Number(events[i]["ActionID"]), [events[i]])
        lastActionID = Number(events[i]["ActionID"])
        const readyResponse = this.responses.get(lastActionID)
        if (readyResponse) {
          this.callListeners(Number(events[i]["ActionID"]));
        }
        //lastActionID = Number(events[i]["ActionID"])
        //this.responses.set(Number(events[i]["ActionID"]), [events[i]])
        //events.splice(i, 0)
      } else if (events[i]["Event"] && !events[i]["ActionID"] && this.listeners.has(events[i]["Event"])) { // is an event asterisk is sending back without being triggered with an action
        // send event
        const listener = this.listeners.get(events[i]["Event"]);
        if (listener) {
          await listener([events[i]])
        }
        //events.splice(i, 1)
      } else if (!events[i]["ActionID"] && !events[i]["Event"] && lastActionID) { // a continuation of a previous event but without an action id (eg getconfig action)
        const e = this.responses.get(lastActionID)
        if (e) { // we know e exists because of the conditional, but tsc complains it might be undefined...
          //e.push(events[i])
          e[e.length - 1] = {
            ...e[e.length - 1],
            ...events[i]
          }
          this.responses.set(lastActionID, e)
        }
        //events.splice(i, 0)
      } else if (events[i]["ActionID"] && this.responses.has(Number(events[i]["ActionID"]))) { // also a continuation, but with an action id on it (eg peer entry)
        const e = this.responses.get(Number(events[i]["ActionID"]))
        if (e) { // we know e exists because of the conditional, but tsc complains it might be undefined...
          e.push(events[i])
          this.responses.set(Number(events[i]["ActionID"]), e)
        }
        //events.splice(i, 0)
      } else { // an event that wasn't triggered with an action, but we have no listener
      }
    }
  }

  /**
   * Custom logging method
   *
   * @param message - Message to log
   * @param level - Log level
   */
  private log(message: string, level: LogLevels): void {
    message = "[DAMI] | " + level + " | " + message;
    if (console[level] !== undefined && this.configs.logger === true) {
      console[level](message);
    }
  }
}
