/**
 * Hostname of the server to connect to
 * Port of the server to connect to
 */
interface IConfigs {
  hostname?: string;
  port: number;
  logger?: boolean;
}

type LogLevels = "error" | "info" | "log";

export interface DAMIData {
  [key: string]: string | number | string[];
}

const defaultConfigs = {
  hostname: "localhost",
  port: 3000,
  logger: true,
};

export class DAMI {
  /**
   * Constructor configs, to connect to the AMI
   */
  private readonly configs: IConfigs;

  private auth: { username: string; secret: string } | null = null;

  /**
   * The connection to the AMI
   */
  public conn: Deno.Conn | null = null;

  /**
   * Holds all events user wishes to listen on, where `string` is the event name
   */
  private listeners: Map<string, Function>;

  /**
   * Tells DAMI if a command is in progress for the trigger event method
   */
  private command_in_progress = false;

  /**
   * @param configs - Hostname and port of the AMI to connect to
   */
  constructor(configs: IConfigs = defaultConfigs) {
    this.configs = configs;
    this.listeners = new Map();
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
    this.auth = auth;
    if (!this.conn) {
      // Connect
      this.conn = await Deno.connect(
        { hostname: this.configs.hostname, port: this.configs.port },
      );

      this.log(
        `Connected to ${this.configs.hostname}:${this.configs.port}`,
        "info",
      );

      // Login
      const loginMessage = this.formatAMIMessage("Login", auth);
      await this.conn!.write(loginMessage);

      return;
    }
    throw new Error("A connection has already been made");
  }

  /**
   * Send a message/event to the AMI
   *
   * @param actionName - The name of the event
   * @param data - The data to send across, in key value pairs
   */
  public async to(actionName: string, data: DAMIData): Promise<void> {
    const message = this.formatAMIMessage(actionName, data);
    data["Action"] = actionName;
    this.log("Sending event:", "info");
    this.log(JSON.stringify(data), "info");
    await this.conn!.write(message);
  }

  /**
   * Listen on a certain event from the AMI
   *
   * @param eventName - Event name to listen for
   * @param cb - Your callback, which is called with the AMI data
   */
  public on(eventName: string, cb: (data: DAMIData) => void): void {
    this.listeners.set(eventName, cb);
  }

  /**
   * Send an action, to get the AMI to trigger an event, which you can handle directly.
   *
   * Use case for this, could be sending the action `GetConfig`
   *
   * ```ts
   * // We want to get the SIP peers
   * await Dami.triggerEvent("SIPPeers", {}, (data) => {
   *   console.log(data.length) // 2
   *   console.log(data[0]["Event]) // PeerEntry
   * }
   * // or
   * const res = await Dami.triggerEvent("SIPPeers", {});
   * ```
   *
   * @param actionName - The name of the action
   * @param data - Data to accompany the message
   * @param cb - The callback to handle the response for
   */
  public async triggerEvent(
    actionName: string,
    data: DAMIData,
    cb?: (data: DAMIData) => void,
  ): Promise<null | DAMIData> {
    // Close the connection so our `listen` method stops listening. We cannot seem to have 2 listeners at the same time.
    this.close();
    this.conn = null;
    // Log back in, not ideal but no other way i can figure this out
    if (!this.auth) {
      this.log("Missing authentication credentials.", "error");
      return null;
    }
    await this.connectAndLogin(this.auth);
    this.command_in_progress = true;
    // try/catch just in case anything possibly fails, we can set the progress to false, so the `listen` method can continue  to work
    try {
      const message = this.formatAMIMessage(actionName, data);
      await this.conn!.write(message);

      // Because asterisk can sometimes not send all the data at once (more than 1 event), we can't just count on returning the first response. So here we just wait 1s and combine all the responses  into one
      let timeToWaitReached: boolean = false;
      setTimeout(async () => {
        timeToWaitReached = true;
        try {
          await this.conn!.write(message); // When done, make the server send an event, because the `if time to wait = true` is never reached  - the  loop handles each event before the timeout, so the  loop is still just hanging, waiting for a  response before it can check the conditional
        } catch (err) {
          // loop might already be finished
        }
      }, 1000);

      let responses: DAMIData[] = [];
      for await (const chunk of Deno.iter(this.conn!)) {
        if (this.command_in_progress === true) {
          // @ts-ignore because we do actually change the variable above, but the tsc is complaining true and false dont overlap
          if (timeToWaitReached === true) { // NEVER REACHED BECAUSE ALL EVENTS ARE RECIEVED BEFORE THE TIMOUT, SO WHEN TIME TO WAIT IS TRUE, THE CODE PRETTY MUCH HANGS ON for await  ... (essentially still waiting)
            this.command_in_progress = false;
            break;
          } else {
            // Push the response to an array to collect it whilst time to wait hasn't been reached
            // We only care that it is a set object
            if (chunk) {
              let formattedResponse = this.formatAMIResponse(chunk);
              // Ignore auth event (sent straight away so we just need to ignore),  BUT it's possible the chunk contains the event we need
              let hasAuthEvent = Array.isArray(formattedResponse)
                ? formattedResponse.filter((res) =>
                  res["Event"] === "FullyBooted"
                ).length > 0
                : formattedResponse["Event"] === "FullyBooted";
              if (hasAuthEvent && Array.isArray(formattedResponse)) {  // special case for chunk being: [{ response: ... }, { event: fullybooted, ... }, {  CHUNK WE NEED}]
                formattedResponse.splice(0, 2)
                hasAuthEvent = false
              }

              if (hasAuthEvent === false) {
                // Push each 'event block'
                if (Array.isArray(formattedResponse)) {
                  for (const response of formattedResponse) {
                    responses.push(response);
                  }
                } else { // It's an object so just push that
                  responses.push(formattedResponse);
                }

                // Check if error responses, only for logging purposes
                if (
                  Array.isArray(formattedResponse) &&
                  formattedResponse[0]["Response"] === "Error"
                ) {
                  this.log(formattedResponse[0]["Message"].toString(), "error");
                } else if (
                  formattedResponse && !Array.isArray(formattedResponse) &&
                  formattedResponse["Response"]
                ) {
                  if (
                    formattedResponse["Response"] &&
                    formattedResponse["Response"] === "Error"
                  ) {
                    this.log(formattedResponse["Message"].toString(), "error");
                  }
                }

                // We could instead do something  like:
                // const response = this.formatAMIResponse(chunk)
                // if (response["Event"] === actionEventPairs[actionName]) {
                //   res = response;
                //   //break; maybe?
                // }
                // So the event name on the response will match what  triggers it. This is used in case an event is sent back to us but due to race conditions, the event isn't related, for example.. we listen BUT asterisk sends a register event - that isnt what we want is it. We are hoping to pick up a single event and thats it
                //  Where actionEventPairs is `{ SIPPeers: ["PeerEntry, PeerlistComplete"],  GetConfig: "?" }`
                // Those are the only two i know, we can  mention in the  docs that is people wish for more, they can make an issue and ill add it
              }
            }
          }
        } else {
          break;
        }
      }

      // Now with all those responses in an array, combine each one into a single object (using each property of each item)
      let responseObj: DAMIData = {};
      for (const response of responses) {
        Object.keys(response).forEach((key) => {
          responseObj[key] = response[key];
        });
      }

      // And call the callback or return the data
      this.command_in_progress = false;
      await this.listen();
      if (cb) {
        await cb(responseObj);
      } else {
        return responseObj;
      }
      return null;
    } catch (err) {
      this.command_in_progress = false;
      return null;
    }
  }

  /**
   * Listens for any events from the AMI and does ?? with them
   */
  public async listen(): Promise<void> {
    (async () => {
      try {
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
            await this.handleAMIResponse(chunk);
          }
        }
      } catch (e) {
        // because when `triggerEvent` is called, we close the conn so it will fail, but nothing is actually wrong
        if (this.command_in_progress === false) {
          this.log(
            "Connection failed whilst receiving an event from the AMI. The connection may already be closed. Stopping.",
            "error",
          );
          this.close();
        }
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
  private formatAMIMessage(actionName: string, data: DAMIData): Uint8Array {
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
   * @param chunk - Data received from AMI, from the `listen` method
   *
   * @returns A key value pair of all the data sent by the AMI
   */
  private formatAMIResponse(chunk: Uint8Array): DAMIData | DAMIData[] {
    function formatArrayIntoObject(arr: string[]): DAMIData {
      arr = arr.filter((data) => data !== ""); // strip empty lines
      let responseObject: DAMIData = {};
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

    const response: string = new TextDecoder().decode(chunk); // = "Response: Success\r\nMessage: ..."
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
      const responseArr: Array<DAMIData> = [];
      blocks.forEach((block) => {
        const formattedBlock = formatArrayIntoObject(block);
        if (formattedBlock) {
          responseArr.push(formattedBlock);
        }
      });
      return responseArr;
    } else { //  It's a  single event block, so return an object
      const responseObject = formatArrayIntoObject(dataArr);
      return responseObject;
    }
  }

  /**
   * Responsible for handling a response from the AMI, to call any listeners on the event name
   *
   * @param chunk - Response from AMI
   */
  private async handleAMIResponse(chunk: Uint8Array): Promise<void> {
    const runChecksOnResponseAndSend = async (obj: DAMIData) => {
      if (!obj["Event"]) {
        return;
      }
      // else it's  an asterisk event
      const event: string = obj["Event"].toString();
      if (event) {
        if (this.listeners.has(event)) {
          this.log("Calling listener for " + event, "info");
          const listener = this.listeners.get(event);
          if (listener) {
            await listener(obj);
          }
        } else {
          this.log(
            "No listener is set for the event `" + event + "`",
            "info",
          );
        }
      }
    };
    const data = this.formatAMIResponse(chunk);
    if (Array.isArray(data)) {
      //  Special case for the FullyBooted event, where it is sent as 2 blocks on auth, and 1 block when failed auth
      if (data[1] && data[1]["Event"] === "FullyBooted") {
        data[1]["Response"] = data[0]["Response"];
        data[1]["Message"] = data[0]["Message"];
      }
      for (const d of data) {
        await runChecksOnResponseAndSend(d);
      }
    } else {
      await runChecksOnResponseAndSend(data);
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
