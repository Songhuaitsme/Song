import { pbkdf2Sync, randomBytes } from "node:crypto";

function readHidden(prompt) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY) return reject(new Error("请在交互式终端中运行此命令。"));
    let value = "";
    process.stdout.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf8");
    const finish = () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
      process.stdin.off("data", onData);
    };
    const onData = (character) => {
      if (character === "\u0003") {
        finish();
        reject(new Error("已取消。"));
      } else if (character === "\r" || character === "\n") {
        finish();
        resolve(value);
      } else if (character === "\u007f" || character === "\b") {
        if (value) {
          value = value.slice(0, -1);
          process.stdout.write("\b \b");
        }
      } else if (character >= " ") {
        value += character;
        process.stdout.write("•");
      }
    };
    process.stdin.on("data", onData);
  });
}

const password = await readHidden("请输入新的管理员密码：");
const confirmation = await readHidden("请再次输入：");
if (password !== confirmation) throw new Error("两次输入的密码不一致。");
if (password.length < 12) throw new Error("密码至少需要 12 个字符。");
const iterations = 310_000;
const salt = randomBytes(16);
const digest = pbkdf2Sync(password, salt, iterations, 32, "sha256");
const base64url = (value) => value.toString("base64url");
process.stdout.write(`\npbkdf2-sha256$${iterations}$${base64url(salt)}$${base64url(digest)}\n`);
