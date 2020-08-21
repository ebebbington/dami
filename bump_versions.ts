const branch: string = Deno.args[0].split("=")[1];
const version = branch.substring(branch.indexOf("v") + 1); // 1.0.5
let eggsContent = new TextDecoder().decode(await Deno.readFile("./egg.json"));
eggsContent = eggsContent.replace(/"version": "[0-9\.]+[0-9\.]+[0-9\.]"/, `"version: "${version}"`);
//await Deno.writeFile("./egg.json", new TextEncoder().encode(eggsContent));
