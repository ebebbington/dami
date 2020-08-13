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
  [key: string]: string | number;
}

const defaultConfigs = {
  hostname: "localhost",
  port: 3000,
  logger: true,
};

export class DenoTcpDuplexConnection {
  conn: Deno.Conn;
  _closed = false;

  constructor(conn: Deno.Conn) {
    this.conn = conn;
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<Uint8Array> {
    return Deno.iter(this.conn);
  }

  write(chunk: Uint8Array): Promise<number> {
    return this.conn.write(chunk);
  }

  close() {
    if (!this._closed) {
      this._closed = true;
      this.conn.close();
    }
  }
}

interface DuplexConnection extends AsyncIterable<Uint8Array> {
  write(chunk: Uint8Array): Promise<any>;

  [Symbol.asyncIterator](): AsyncIterableIterator<Uint8Array>;

  close(): void;
}

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
   * Similar to type `this.conn`, but uses to listen for messages
   */
  private duplex_conn: DuplexConnection | undefined;

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
    if (this.conn) {
      this.conn.close();
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
    if (!this.conn) {
      this.conn = await Deno.connect(
        { hostname: this.configs.hostname, port: this.configs.port },
      );
      this.duplex_conn = new DenoTcpDuplexConnection(this.conn);
      this.log(
        `Connected to ${this.configs.hostname}:${this.configs.port}`,
        "info",
      );
      await this.login(auth);
      return;
    }
    throw new Error("A connection has already been made");
  }

  /**
   * Send a message/event to the AMI
   *
   * @param eventName - The name of the event
   * @param data - The data to send across, in key value pairs
   */
  public async to(eventName: string, data: DAMIData): Promise<void> {
    let eventString = `Action: ${eventName}\r\n`;
    Object.keys(data).forEach((key) => {
      eventString += `${key}: ${data[key]}\r\n`;
    });
    eventString += `\r\n`;
    if (this.conn) {
      this.log("Sending event " + eventString, "info");
      await this.conn.write(new TextEncoder().encode(eventString));
    }
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
        if (this.duplex_conn) {
          for await (const chunk of this.duplex_conn) {
            if (!chunk) {
              this.log(
                "Invalid response from event received from the AMI. Closing connection",
                "error",
              );
              if (this.conn) {
                this.conn.close();
              }
              break;
            } else {
              this.log("Received event from the AMI", "info");
              this.handleAMIResponse(chunk);
            }
          }
        }
      } catch (e) {
        this.log(
          "Connection failed whilst receiving an event from the AMI. Closing connection",
          "error",
        );
        if (this.conn) {
          this.conn.close();
        }
      }
    })();
  }

  /**
   * Send a Login action to the AMI to authenticate
   *
   * @param auth - Username and secret of the account to login as
   */
  private async login(
    auth: { username: string; secret: string },
  ): Promise<void> {
    const username = auth.username;
    const secret = auth.secret;
    if (this.conn) {
      await this.conn.write(
        new TextEncoder().encode(
          `action: Login\r\nusername: ${username}\r\nsecret: ${secret}\r\n\r\n`,
        ),
      );
      this.log(`Authenticated, and logged in`, "info");
    }
  }

  /**
   * Formats the event data from the AMI into a nice key value pair format
   *
   * @param chunk - Data received from AMI, from the `listen` method
   *
   * @returns A key value pair of all the data sent by the AMI
   */
  private formatAMIResponse(chunk: Uint8Array): DAMIData {
    const response: string = new TextDecoder().decode(chunk); // = "Response: Success\r\nMessage: ..."
    let dataArr: string[] = response.split("\n"); // = ["Response: Success\r", "Message: ..."]
    dataArr = dataArr.map((data) => data.replace(/\r/, "")); // remove \r characters, = ["Response: Success", "Message: ..."]
    dataArr = dataArr.filter((data) => data !== ""); // strip empty lines

    let responseObject: DAMIData = {};
    dataArr.forEach((data) => { // data = "Something: something else"
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
    });

    return responseObject;
  }

  /**
   * Responsible for handling a response from the AMI, to call  any listeners on the event name
   *
   * @param chunk - Response from AMI
   */
  private async handleAMIResponse(chunk: Uint8Array): Promise<void> {
    const data: DAMIData = this.formatAMIResponse(chunk);
    const action: string = data["Action"].toString();
    if (action) {
      if (this.listeners.has(action)) {
        this.log("Calling listener for " + action, "info");
        const listener = this.listeners.get(action);
        if (listener) {
          listener(data);
        }
      } else {
        this.log(
          "No listener is set for the event `" + action + "`",
          "info",
        );
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
