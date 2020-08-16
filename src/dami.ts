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

const actionEventPairs: {[key: string]: string[]} = {
  SIPPeers: ["PeerEntry", "PeerListComplete"]
}

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

  /**
   * The connection to the AMI
   */
  public conn: Deno.Conn | null = null;

  /**
   * Holds all events user wishes to listen on, where `string` is the event name
   */
  private listeners: Map<string, Function>;

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
    this.conn!.close()
  }

  /**
   * Connect to the server, and authenticate (login)
   *
   * @param auth - Username and secret to use in the login event
   */
  public async connectAndLogin(
    auth: { username: string; secret: string },
  ): Promise<void> {
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
      const loginMessage = this.formatAMIMessage("Login", auth)
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
    const message = this.formatAMIMessage(actionName, data)
    data["Action"] = actionName
    this.log("Sending event:", "info");
    this.log(JSON.stringify(data), "info")
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
   * Send an action, to get the AMI to trigger an event, which you can handle.
   *
   * ```ts
   * // We want to get the SIP peers
   * await Dami.triggerEvent("SIPPeers", {}, (data) => {
   *   console.log(data["Event"]) // "PeerlistComplete"
   * }
   * // or
   * const res = await Dami.triggerEvent("SIPPeers", {});
   * console.log(res["Event"] // "PeerlistComplete"
   * ```
   *
   * @param actionName - The name of the action
   * @param data - Data to accompany the message
   * @param cb - The callback to handle the response for
   */
  // public async triggerEvent (actionName: string, data: DAMIData, cb?: (data: DAMIData) => void): Promise<void|DAMIData> {
  //   const message = this.formatAMIMessage(actionName, data);
  //   await this.conn!.write(message);
  //   let res;
  //   for await (const chunk of Deno.iter(this.conn!)) {
  //     if (chunk) {
  //       const response = this.formatAMIResponse(chunk);
  //       if (response["Event"] === actionEventPairs[actionName]) {
  //         res = response;
  //         //break;
  //       }
  //     }
  //   }
  //   if (cb) {
  //     //@ts-ignore Because im unsure on how to fix the error of: "Argument of type 'DAMIData | void' is not assignable to parameter of type 'DAMIData'."
  //     await cb(res)
  //   } else {
  //     return res
  //   }
  // }

  /**
   * Listens for any events from the AMI and does ?? with them
   */
  public async listen(): Promise<void> {
    (async () => {
      try {
        for await (const chunk of Deno.iter(this.conn!)) {
          if (!chunk) {
            this.log("Invalid response from event received from the AMI. Closing connection", "error",);
            this.conn!.close();
            break;
          } else {
            this.log("Received event from the AMI", "info");
            await this.handleAMIResponse(chunk);
          }
        }
      } catch (e) {
        this.log(
          "Connection failed whilst receiving an event from the AMI. The connection may already be closed. Stopping.",
          "error",
        );
        try {
          this.conn!.close();
        } catch  (err) {}
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
  private formatAMIMessage (actionName: string, data: DAMIData): Uint8Array {
    let eventString = `action: ${actionName}\r\n`;
    Object.keys(data).forEach((key) => {
      eventString += `${key}: ${data[key]}\r\n`;
    });
    eventString += `\r\n`;
    return new TextEncoder().encode(eventString)
  }

  /**
   * Formats the event data from the AMI into a nice key value pair format
   *
   * @param chunk - Data received from AMI, from the `listen` method
   *
   * @returns A key value pair of all the data sent by the AMI
   */
  private formatAMIResponse(chunk: Uint8Array): DAMIData|DAMIData[] {
    function formatArrayIntoObject (arr: string[]): DAMIData {
      arr = arr.filter((data) => data !== ""); // strip empty lines
      let responseObject: DAMIData = {};
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
          const dataSplit = data.split(":");
          if (dataSplit.length === 1) { // eg data = "Asterisk ..." (and not an actual property
            return;
          }
          const name = dataSplit[0];
          let value: string | number = dataSplit[1];
          // Values  can have a space before the value, due to the split: "a: b".split(":") === ["a", " b"]
          if (value[0] === " ") {
            value = value.substring(1);
          }
          // If the value is a number, make it so
          if (!isNaN(Number(dataSplit[1]))) {
            value = Number(value);
          }
          responseObject[name] = value;
        }
      });
      return responseObject
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
    const startOfNewSectionIndex = dataArr.indexOf("");
    if (startOfNewSectionIndex !==  -1) { // the event has multiple sections, so we put it into an array instead
      const blocks: Array<Array<string>> = [];
      function loop (arr: string[]): void {
        if (arr[0] === "") { // has an empty 0th index, eg a 1+n section so  remove it
          arr.splice(0, 1)
        }

        // And if there are no truthy values, do nothing
        if (arr.filter(a => a !== "").length === 0) {
          return
        }

        if (arr.indexOf("") === -1) { // Reached the last section
          blocks.push(arr)
          return
        }
        const otherSections = arr.splice(arr.indexOf(""))
        blocks.push(arr);
        loop(otherSections)
      }
      loop(dataArr);
      const responseArr: Array<DAMIData> = [];
      blocks.forEach(block => {
        const formattedBlock = formatArrayIntoObject(block)
        if (formattedBlock) {
          responseArr.push(formattedBlock)
        }
      })
      return responseArr
    } else { //  It's a  single event block, so return an object
      const responseObject =  formatArrayIntoObject(dataArr)
      return responseObject
    }

  }

  /**
   * Responsible for handling a response from the AMI, to call any listeners on the event name
   *
   * @param chunk - Response from AMI
   */
  private async handleAMIResponse(chunk: Uint8Array): Promise<void> {
    const data = this.formatAMIResponse(chunk);
    if (Array.isArray(data)) {
      //  Special case for the FullyBooted event, where it is sent as 2 blocks on auth, and 1 block when failed auth
      if (data[1] && data[1]["Event"] === "FullyBooted")  {
        data[1]["Response"] = data[0]["Response"]
        data[1]["Message"] = data[0]["Message"]
      }

      data.forEach(async (d) => {
        if (!d["Event"]) {
          return; // is a command
        }
        const event: string = d["Event"].toString();
        if (event) {
          if (this.listeners.has(event)) {
            this.log("Calling listener for " + event, "info");
            const listener = this.listeners.get(event);
            if (listener) {
              await listener(d);
            }
          } else {
            this.log(
                "No listener is set for the event `" + event + "`",
                "info",
            );
          }
        }
      })
    } else {
      if (!data["Event"]) {
        return;
      }
      // else it's  an asterisk event
      const event: string = data["Event"].toString();
      if (event) {
        if (this.listeners.has(event)) {
          this.log("Calling listener for " + event, "info");
          const listener = this.listeners.get(event);
          if (listener) {
            await listener(data);
          }
        } else {
          this.log(
              "No listener is set for the event `" + event + "`",
              "info",
          );
        }
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
