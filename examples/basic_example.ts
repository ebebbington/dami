import { DAMI } from "../src/dami.ts";

const ami = {
  hostname: "0.0.0.0",
  port: 5038,
  logger: true,
};

const auth = {
  username: "admin",
  secret: "mysecret",
};

const Dami = new DAMI(ami);
await Dami.connect(auth);
await Dami.to("GetConfig", { filename: "sip.conf" });
Dami.on("PeerStatus", () => {
  console.log("GOT PEER STATUS");
});
