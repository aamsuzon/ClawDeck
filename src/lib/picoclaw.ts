import { promisify } from "node:util";
import { execFile as execFileCb } from "node:child_process";
import { PICO_EXE } from "@/lib/paths";

const execFile = promisify(execFileCb);

export type CliResult = {
  stdout: string;
  stderr: string;
};

async function runCli(args: string[]): Promise<CliResult> {
  const { stdout, stderr } = await execFile(PICO_EXE, args, {
    timeout: 20_000,
    maxBuffer: 10 * 1024 * 1024,
    windowsHide: true,
  });

  return {
    stdout: String(stdout ?? "").trim(),
    stderr: String(stderr ?? "").trim(),
  };
}

export async function runPicoclawStatus(): Promise<CliResult> {
  return runCli(["status"]);
}

export async function runCronList(): Promise<CliResult> {
  return runCli(["cron", "list"]);
}

export async function runCronAdd(args: {
  name: string;
  cron: string;
  message: string;
  deliver: boolean;
  channel?: string;
  to?: string;
}): Promise<CliResult> {
  const cliArgs = ["cron", "add", "-n", args.name, "-c", args.cron, "-m", args.message];

  if (args.deliver) {
    cliArgs.push("--deliver");
    if (args.channel) {
      cliArgs.push("--channel", args.channel);
    }
    if (args.to) {
      cliArgs.push("--to", args.to);
    }
  }

  return runCli(cliArgs);
}

export async function runCronAction(action: "enable" | "disable" | "remove", id: string): Promise<CliResult> {
  return runCli(["cron", action, id]);
}

export async function runAgentMessage(message: string, session?: string): Promise<CliResult> {
  const args = ["agent", "-m", message];

  if (session) {
    args.push("-s", session);
  }

  return runCli(args);
}

export async function restartGatewayWindows(): Promise<CliResult> {
  if (process.platform !== "win32") {
    throw new Error("Gateway restart helper currently supports Windows only.");
  }

  const psScript = [
    "Get-Process picoclaw -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue",
    "Start-Sleep -Seconds 1",
    "Start-Process -FilePath 'C:\\picoclaw\\picoclaw.exe' -ArgumentList 'gateway' -WorkingDirectory 'C:\\picoclaw'",
    "Start-Sleep -Seconds 1",
    "Write-Output 'gateway_restarted'",
  ].join("; ");

  const { stdout, stderr } = await execFile("powershell", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", psScript], {
    timeout: 20_000,
    maxBuffer: 5 * 1024 * 1024,
    windowsHide: true,
  });

  return {
    stdout: String(stdout ?? "").trim(),
    stderr: String(stderr ?? "").trim(),
  };
}
