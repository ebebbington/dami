/**
 * Hostname of the server to connect to
 * Port of the server to connect to
 */
import { readStringDelim } from "../deps.ts";

type SuccessAuthEvent = {
  Response: "Success";
  Message: "Authentication accepted";
};

type FullyBootedEvent = {
  Event: "FullyBooted";
  Privilege: string; // eg "system,all"
  Update: number;
  LastReload: number;
  Status: "Fully Booted";
};

interface IConfigs {
  hostname?: string;
  port: number;
  logger?: boolean;
  certFile?: string;
}

let nextActionId = 0;

type LogLevels = "error" | "info" | "log";

export type Event = { [key: string]: string | number } & { Output?: string[] };

export type Action = { [key: string]: string | number };

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
   * or the event name when simple listening with `on`
   *
   * Specifically for on listeners
   */
  private on_listeners: Map<number | string, (event: Event) => void> =
    new Map();

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
  public async connect(
    auth: { username: string; secret: string },
  ): Promise<[SuccessAuthEvent, FullyBootedEvent]> {
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

    // Get the connect message out of the way
    for await (const message of readStringDelim(this.conn, "\r\n")) {
      break;
    }
    this.log(
      `Connected to ${this.configs.hostname}:${this.configs.port}`,
      "info",
    );

    // Login
    const loginMessage = this.formatAMIMessage("Login", auth);
    await this.conn!.write(loginMessage);

    // Get the login events out the way
    const loginEvents: Event[] = [];
    for await (const message of readStringDelim(this.conn, "\r\n\r\n")) {
      const result = this.formatAMIResponse(message);
      loginEvents.push(result);
      if (loginEvents.length === 2) {
        break;
      }
    }
    if (loginEvents[0]["Message"] === "Authentication failed") {
      this.close();
      throw new Error(
        `Authentication failed. Unable to login. Check your username and password are correct.`,
      );
    }

    // Listen
    await this.listen();

    // Return the auth/login events data
    const authEvent = loginEvents[0] as SuccessAuthEvent;
    const fullyBootedEvent = loginEvents[1] as FullyBootedEvent;
    return [authEvent, fullyBootedEvent];
  }

  /**
   * Ping the ami
   *
   * @returns Whether we we got a pong or not
   */
  public async ping(): Promise<boolean> {
    const res = await this.to("ping", {});
    if (res[0]["Ping"] === "Pong" && res[0]["Response"] === "Success") {
      return true;
    }
    return false;
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
    data: Action = {},
  ): Promise<Event[]> {
    // Logging purposes
    this.log("Sending event for: " + actionName, "info");
    this.log(JSON.stringify(data), "info");

    // Write message
    data["ActionID"] = this.generateActionId();
    const message = this.formatAMIMessage(actionName, data);
    await this.conn!.write(message);

    const results = [];
    for await (const message of readStringDelim(this.conn!, "\r\n\r\n")) {
      const result = this.formatAMIResponse(message);

      // for when errors occur
      if (result["Response"] === "Error") {
        throw new Error(
          result["Message"]
            ? result["Message"].toString()
            : "Unknown error. " + JSON.stringify(result),
        );
      }

      // save the result
      results.push(result);

      // When a list is being sent, check so we know when to break
      if (
        results.length && results[0]["EventList"] &&
        results[0]["EventList"] === "start" && result["EventList"] &&
        result["EventList"] === "Complete"
      ) {
        break;
      }

      // When it's just a single event, but make sure we don't break if a list IS being sent...
      if (!results[0]["EventList"] && !result["EventList"]) {
        break;
      }
    }

    // Because the above loop breaks our listen, reinitiate it
    await this.listen();

    return results;
  }

  /**
   * Listen on a certain event from the AMI
   *
   * @param eventName - Event name to listen for
   * @param cb - Your callback, which is called with the AMI data
   */
  public on(eventName: string, cb: (data: Event) => void): void {
    this.on_listeners.set(eventName, cb);
  }

  /**
   * Listens for any events from the AMI that it sends itself
   */
  private async listen(): Promise<void> {
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
            const event = new TextDecoder().decode(chunk);
            await this.handleAMIResponse(event);
          }
        }
      } catch (e) {
        this.log(e.message, "error");
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
   * @param message - The decoded message from the AMI
   *
   * @returns A key value pair of all the data sent by the AMI
   */
  private formatAMIResponse(message: string): Event {
    let lines: string[] = message.split("\r\n"); // ["Response: Message", ...]
    lines = lines.filter((data) => data !== ""); // strip empty lines
    const responseObject: Event = {};
    // Create key value pairs from each line in the response
    lines.forEach((data) => { // data = "Something: something else"
      // If it has an "Output: ..." line, then there's a chance there are multiple Output lines
      // command response
      if (data.indexOf("Output: ") === 0) { // we do this because there are multiple "Output: " items returned (eg multiple items in the array), so when we do  `responseObj[key] = value`, it just overwrites the data
        // For example, data might come across as:
        // ["Output: Name/username         Host          Dyn",
        // "Output: 6001                  (Unspecified)  D"]
        const dataSplit = data.split(/: (.+)/); // only split first occurrence, as we can have data that is like: "Output: 2 sip peers [Monitored: ..."
        if (responseObject["Output"]) { // We have already added the output property
          if (
            typeof responseObject["Output"] !== "number" &&
            typeof responseObject["Output"] !== "string"
          ) { // append
            responseObject["Output"].push(dataSplit[1]);
          }
        } else { // create it
          responseObject["Output"] = [];
          responseObject["Output"].push(dataSplit[1]);
        }
        return;
      }
      // event response
      const [name, value] = data.split(": ");
      // If the value is a number, make it so
      if (!isNaN(Number(value))) {
        responseObject[name] = Number(value);
      } else {
        responseObject[name] = value;
      }
    });
    return responseObject;
  }

  private generateActionId(): number {
    nextActionId++;
    if (
      nextActionId === Number.MAX_SAFE_INTEGER ||
      (nextActionId - 1) === Number.MAX_SAFE_INTEGER
    ) {
      nextActionId = 1;
    }
    return nextActionId;
  }

  /**
   * Responsible for handling a response from the AMI, to call any listeners on the event name
   *
   * @param message - Response from AMI
   */
  private async handleAMIResponse(message: string): Promise<void> {
    const event = this.formatAMIResponse(message);

    // If it has an action id, then it's not for us. Probably an edge case as we shouldn't be handling those.
    if (event["ActionID"]) {
      throw new Error(
        "Unknown error, this is most likely a bug. Report an issue describing how you got to this stage",
      );
    }

    // or for when errors occur. Not sure if this would ever happen
    if (event["Response"] && event["Response"] === "Error") {
      throw new Error(event["Message"].toString());
    }

    // Get the listener and call it
    const listener = this.on_listeners.get(event["Event"]);
    if (listener) {
      this.log("Found listener for " + event["Event"] + " event", "info");
      await listener(event);
    } else {
      this.log(
        "No listener was found for " + event["Event"] + " event",
        "info",
      );
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
