const branch: string = Deno.args[0].split("=")[1];
const version = branch.substring(branch.indexOf("v") + 1); // 1.0.5
console.log(version)
let eggsContent = new TextDecoder().decode(await Deno.readFile("./egg.json"))
eggsContent = eggsContent.replace("1.0.5", version)
await Deno.writeFile('./egg.json', new TextEncoder().encode(eggsContent))
