/**
 * Hostname of the server to connect to
 * Port of the server to connect to
 */
import { Deferred, deferred, readStringDelim } from "../deps.ts";

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

export type Cb = ((event: Event) => void) | ((event: Event) => Promise<void>);

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
   * Tracks whether we do have a connection to the AMI
   */
  public connected = false;

  /**
   * Holds all events user wishes to listen on, where the
   * index is the action id (if trigger events with `to`),
   * or the event name when simple listening with `on`
   *
   * Specifically for on listeners
   */
  private on_listeners: Map<string, Cb> = new Map();

  private ops: Map<number, Deferred<Event[]>> = new Map();

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
    } catch (_err) {
      // dont  need to do anything
    }
    this.connected = false;
  }

  /**
   * Connect to the server, and authenticate (login).
   * If a listener has been created for `FullyBooted`,
   * this method will also call that listener
   *
   * @param auth - Username and secret to use in the login event
   *
   * @returns An array containing the data for the auth response and fully booted event
   */
  public async connect(
    auth: { username: string; secret: string },
  ): Promise<[SuccessAuthEvent, FullyBootedEvent]> {
    if (this.connected) {
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
    this.connected = true;

    // Get the connect message out of the way
    for await (const _message of readStringDelim(this.conn, "\r\n")) {
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
    for await (const message of readStringDelim(this.conn, "\r\n\r\n")) { // Usually, we get a message aying auth i accepted, then we get the fully booted event, but sometimes, a "MessageWaiting" event is the 2nd message we get
      const result = this.formatAMIResponse(message);

      if (result["Message"] === "Authentication failed") {
        this.close();
        throw new Error(
          `Authentication failed. Unable to login. Check your username and password are correct.`,
        );
      }

      if (
        result["Event"] === "FullyBooted" ||
        result["Message"] === "Authentication accepted"
      ) {
        loginEvents.push(result);
      }
      if (loginEvents.length === 2) {
        break;
      }
    }
    const authEvent = loginEvents[0] as SuccessAuthEvent;
    const fullyBootedEvent = loginEvents[1] as FullyBootedEvent;

    // Listen
    this.listen();

    // If a user has created a `FullyBooted` listener, call that also
    if (this.on_listeners.has("FullyBooted")) {
      const listener = this.on_listeners.get("FullyBooted") as Cb;
      listener(fullyBootedEvent);
    }

    // Return the auth/login events data
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
   *
   * @returns The events
   */
  public async to(
    actionName: string,
    data: Action = {},
  ): Promise<Event[]> {
    // Logging purposes
    this.log("Sending event for: " + actionName, "info");
    this.log(JSON.stringify(data), "info");

    // Construct data
    const actionId = this.generateActionId();
    data["ActionID"] = actionId;
    const message = this.formatAMIMessage(actionName, data);

    // Write message and wait for response
    this.ops.set(actionId, deferred());
    await this.conn!.write(message);
    const results = await this.ops.get(actionId) as Event[];
    if (results[0]["Error"]) {
      const msg = results[0]["Error"] as string;
      throw new Error(msg);
    }
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
   * Remove  a given listener.
   * Throws an error if no listner is set for the given event name
   *
   * @param eventName - The event for which you created a listener for
   *
   * @example
   * ```ts
   * Dami.on("PeerStatus", (event: Event) => {
   *
   * })
   * Dami.removeListener("PeerStatus"
   * ```
   */
  public removeListener(eventName: string): void {
    if (this.on_listeners.has(eventName) === false) {
      throw new Error(
        `Cannot remove listener for ${eventName}, as one doesn't exist`,
      );
    }
    this.on_listeners.delete(eventName);
    this.log(`Removed  event listener for: "${eventName}`, "info");
  }

  /**
   * Listens for any events from the AMI that it sends itself
   */
  private listen(): void {
    (async () => {
      const errors: string[] = [];
      const events: Event[] = [];
      try {
        for await (const message of readStringDelim(this.conn!, "\r\n\r\n")) {
          if (message.trim() === "") {
            return;
          }

          // Format and construct the data
          const event = this.formatAMIResponse(message);
          this.log(
            "Received event from the AMI: " + JSON.stringify(event),
            "info",
          );

          // for when errors occur
          if (event["Response"] === "Error") {
            errors.push(
              event["Message"]
                ? event["Message"].toString()
                : "Unknown error. " + JSON.stringify(event),
            );
          }

          // Save the event
          events.push(event);

          // When a list is being sent, check so we know when to break
          if (
            events.length && events[0]["EventList"] &&
            events[0]["EventList"] === "start" &&
            event["EventList"] &&
            event["EventList"] === "Complete"
          ) {
            break;
          }

          // When it's just a single event, but make sure we don't break if a list IS being sent...
          if (!events[0]["EventList"] && !event["EventList"]) {
            break;
          }
        }
      } catch (err) {
        if (
          err instanceof Deno.errors.BadResource ||
          err instanceof Deno.errors.Interrupted
        ) {
          this.connected = false;
          return;
        }
        throw new Error(err.message);
      }

      // Check if an op is waiting for this message
      if (events[0]["ActionID"]) {
        const actionId = events[0]["ActionID"] as number;
        if (this.ops.has(actionId)) {
          // And if there's an error, send that abck so the `to()` function can handle it, because due to this method being async, an errors thrown cannot be caught externally, and we need to catch them in the tests
          if (errors.length) {
            events[0]["Error"] = errors[0];
          }
          this.ops.get(actionId)!.resolve(events);
          this.ops.delete(actionId);
        }
      } else { // Otherwise it's a normal event sent by asterisk, so handle it like so. By here, there should only ever by one item in the results variable anyways
        // Check for errors first
        if (errors.length) {
          throw new Error(errors[0]);
        }
        // Get the listener and call it
        events.forEach(async (event) => {
          const eventName = event["Event"] as string;
          if (this.on_listeners.has(eventName) === false) {
            this.log(
              "No listener was found for " + event["Event"] + " event",
              "info",
            );
            return;
          }
          this.log("Found listener for " + eventName + " event", "info");
          const listener = this.on_listeners.get(eventName) as Cb;
          await listener(event);
        });
      }

      // Start listening again
      this.listen();
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

  /**
   * Creates the next action id for us to use when sending actions
   */
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
