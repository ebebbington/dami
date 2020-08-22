/**
 * Hostname of the server to connect to
 * Port of the server to connect to
 */
interface IConfigs {
  hostname?: string;
  port: number;
  logger?: boolean;
  certFile?: string
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
   * Used for constantly listen on events (such as Hangup)
   */
  public listener_conn: Deno.Conn | null = null;

  /**
   * Used for sending events
   */
  public action_conn: Deno.Conn | null = null;

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
    try {
      this.listener_conn!.close();
      this.action_conn!.close();
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
    if (this.listener_conn && this.action_conn) {
      throw new Error("A connection has already been made");
    }
    // Connect
    if (this.configs.certFile) {
      console.log(this.configs)
      this.listener_conn = await Deno.connectTls({
        hostname: this.configs.hostname,
        port: this.configs.port,
        certFile: this.configs.certFile
      })
      this.action_conn = await Deno.connectTls({
        hostname: this.configs.hostname,
        port: this.configs.port,
        certFile: this.configs.certFile
      })
    } else {
      this.listener_conn = await Deno.connect({
        hostname: this.configs.hostname,
        port: this.configs.port
      });
      this.action_conn = await Deno.connect({
        hostname: this.configs.hostname,
        port: this.configs.port
      });
    }

    this.log(
      `Connected to ${this.configs.hostname}:${this.configs.port}`,
      "info",
    );

    // Login
    const loginMessage = this.formatAMIMessage("Login", auth);
    await this.listener_conn!.write(loginMessage);
    await this.action_conn!.write(loginMessage);

    return;
  }

  /**
   * Ping the ami
   */
  public async ping(): Promise<boolean> {
    const message = this.formatAMIMessage("ping", {});
    const response = await this.to("ping", { ActionID: 123 });
    const pong = Array.isArray(response) && response.length === 1 &&
      (response[0]["Response"] === "Success" || response[0]["Ping"] === "Pong");
    return pong;
  }

  /**
   * Send a message/event to the AMI
   *
   * @param actionName - The name of the event
   * @param data - The data to send across, in key value pairs
   * @param [cb] - If passed in, will call the callback instead of returning the response
   */
  public async to(
    actionName: string,
    data: DAMIData,
    cb?: (data: DAMIData[]) => void,
  ): Promise<[] | DAMIData[]> {
    // data MUST have an ActionID
    if (!data["ActionID"]) {
      throw new Error(
        "Action `" + actionName + "` must have an `ActionID` set",
      );
    }

    // Logging purposes
    data["Action"] = actionName;
    this.log("Sending event:", "info");
    this.log(JSON.stringify(data), "info");

    // Write message
    const message = this.formatAMIMessage(actionName, data);
    let relatedResponses: DAMIData[] = [];
    await this.action_conn!.write(message);

    // Because asterisk can sometimes not send all the data at once (more than 1 event), we can't just count on returning the first response. So here we just wait 1s and combine all the responses  into one
    let timeToWaitReached: boolean = false;
    setTimeout(async () => {
      timeToWaitReached = true;
      try {
        await this.action_conn!.write(message); // When done, make the server send an event, because the `if time to wait = true` is never reached  - the  loop handles each event before the timeout, so the  loop is still just hanging, waiting for a  response before it can check the conditional
      } catch (err) {
        // loop might already be finished
      }
    }, 2000);

    // Listen for all the events in the time given, and push  each response to an array
    let responses: DAMIData[] = [];
    try {
      for await (const chunk of Deno.iter(this.action_conn!)) {
        // @ts-ignore because we do actually change the variable above, but the tsc is complaining true and false dont overlap
        if (timeToWaitReached === true) {
          break;
        } else {
          // Push the response to an array to collect it whilst time to wait hasn't been reached
          if (chunk) {
            let formattedResponse = this.formatAMIResponse(chunk);

            // Push each 'event block'
            if (Array.isArray(formattedResponse)) {
              for (const response of formattedResponse) {
                responses.push(response);
              }
            } else if (Object.keys(formattedResponse).length) { // It's an object so just push that
              responses.push(formattedResponse);
            }

            // Check if error responses, only for logging purposes
            if (
              Array.isArray(formattedResponse) && formattedResponse.length &&
              formattedResponse[0]["Response"] === "Error"
            ) {
              //@ts-ignore It  throws an error about the types, because we 'havent checked if its an array'... i mean ffs, we have but the tsc just hates us
              const errorMessage = formattedResponse[0]["Message"]
                ? // annoyingly not always present due to the event splitting
                  formattedResponse[0]["Message"].toString()
                : "An unknown error occurred when trying to authenticate";
              this.log(errorMessage, "error");
            } else if (
              formattedResponse && !Array.isArray(formattedResponse) &&
              formattedResponse["Response"]
            ) {
              if (
                formattedResponse["Response"] &&
                formattedResponse["Response"] === "Error"
              ) {
                //@ts-ignore It  throws an error about the types, because we 'havent checked if its an array'... i mean ffs, we have but the tsc just hates us
                const errorMessage = formattedResponse["Message"]
                  ? // annoyingly not always present due to the event splitting
                    formattedResponse["Message"].toString()
                  : "An unknown error occurred when trying to authenticate";
                this.log(errorMessage, "error");
              }
            }
          }
        }
      }
    } catch (err) {
      this.log(
        "Connection failed whilst receiving an event from the AMI. The connection may already be closed. Stopping.",
        "error",
      );
      this.close();
      return [];
    }

    // OLD: Now get the responses where it matches the passed in ActionID
    // NEW: Now get the responses where it doesn't contain the auth event
    relatedResponses = responses.filter((response) =>
      response["Message"] !== "Authentication accepted"
    );
    relatedResponses = relatedResponses.filter((response) =>
      response["Event"] !== "FullyBooted"
    );

    // As events can be separated at times (asterisk sends them in chunks), but still part of a single event, we combine objects before each other
    const newResponses: DAMIData[] = [{}];
    let onObjWithId = false;
    relatedResponses.forEach((response, i) => {
      onObjWithId = !!response["ActionID"];
      if (onObjWithId === false) {
        Object.keys(response).forEach((key) => {
          newResponses[newResponses.length - 1][key] = response[key];
        });
      } else if (onObjWithId === true && newResponses.length > 1) { // create new obj if
        newResponses.push({});
        Object.keys(response).forEach((key) => {
          newResponses[newResponses.length - 1][key] = response[key];
        });
      } else if (onObjWithId && newResponses.length === 1) { // for when the first object in relatedresponses has an id, but we haven't yet added to newresponses (dont create a new item in the  array yet)
        if (newResponses[newResponses.length - 1]["ActionID"]) { // Because say the item we are on has id, and prev has id, but the currennt length  of newresponses is 1, we need to create a new obj for this
          newResponses.push({});
        }
        Object.keys(response).forEach((key) => {
          newResponses[newResponses.length - 1][key] = response[key];
        });
      }
    });
    relatedResponses = newResponses;

    // If the action ID is only present on one object, then the WHOLE array is a single response (event), so combine it like so
    const onlyOneActionIdPresent =
      relatedResponses.filter((response) => !!response["ActionID"]).length ===
        1;
    if (onlyOneActionIdPresent) {
      const newResponse: DAMIData[] = [{}];
      relatedResponses.forEach((response) => {
        Object.keys(response).forEach((key) => {
          newResponse[0][key] = response[key];
        });
      });
      relatedResponses = newResponse;
    }

    // Return the responses or call the callback
    if (cb) { // call callback
      await cb(relatedResponses);
      return [];
    } else if (!cb) { // return response instead
      return relatedResponses;
    }
    return [];
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
   * Listens for any events from the AMI and does ?? with them
   */
  public async listen(): Promise<void> {
    (async () => {
      try {
        for await (const chunk of Deno.iter(this.listener_conn!)) {
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
        // ...
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
