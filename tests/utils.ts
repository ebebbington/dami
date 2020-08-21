export const ami = {
  hostname: "0.0.0.0",
  port: 5038,
  logger: false,
};

export const auth = {
  username: "admin",
  secret: "mysecret",
};

export function sleep(milliseconds: number) {
  const start = new Date().getTime();
  for (let i = 0; i < 1e7; i++) {
    if ((new Date().getTime() - start) > milliseconds) {
      break;
    }
  }
}